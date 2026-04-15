import { messagingApi } from "@line/bot-sdk";
import { BookingStatus } from "@prisma/client";
import { auditLog } from "@/lib/security/audit";

type RichMenuState =
  | "guest"
  | "pending"
  | "waiting_payment_review"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "cancelled";

function getLineClient() {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN is missing");
  }

  return new messagingApi.MessagingApiClient({
    channelAccessToken
  });
}

function mapBookingStatusToState(status: BookingStatus): RichMenuState {
  if (status === "waiting_payment_review") return "waiting_payment_review";
  if (status === "confirmed") return "confirmed";
  if (status === "checked_in") return "checked_in";
  if (status === "cancelled") return "cancelled";
  return "pending";
}

function getRichMenuIdByState(state: RichMenuState): string | null {
  const map: Record<RichMenuState, string | undefined> = {
    guest: process.env.RICH_MENU_ID_GUEST,
    pending: process.env.RICH_MENU_ID_PENDING,
    waiting_payment_review:
      process.env.RICH_MENU_ID_WAITING_PAYMENT || process.env.RICH_MENU_ID_PENDING,
    confirmed: process.env.RICH_MENU_ID_CONFIRMED,
    checked_in: process.env.RICH_MENU_ID_CHECKED_IN,
    completed: process.env.RICH_MENU_ID_COMPLETED,
    cancelled: process.env.RICH_MENU_ID_CANCELLED
  };
  return map[state] || null;
}

export async function syncRichMenuByBookingStatus(lineUserId: string, status: BookingStatus) {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    return { ok: false, skipped: true, reason: "LINE_CHANNEL_ACCESS_TOKEN is missing" };
  }

  const state = mapBookingStatusToState(status);
  const richMenuId = getRichMenuIdByState(state);
  if (!richMenuId) {
    auditLog("warn", "rich_menu_sync_skipped", { lineUserId, status, state, reason: "missing_rich_menu_id" });
    return { ok: false, skipped: true, reason: `No rich menu id configured for state: ${state}` };
  }

  try {
    const client = getLineClient();
    await client.linkRichMenuIdToUser(lineUserId, richMenuId);
    return { ok: true, skipped: false as const, state, richMenuId };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown rich menu sync error";
    auditLog("warn", "rich_menu_sync_failed", { lineUserId, state, richMenuId, reason });
    return {
      ok: false,
      skipped: false,
      reason
    };
  }
}

/**
 * หลัง self-checkout: ใน DB ยังเป็น `status: checked_in` แต่มี `checkedOutAt`
 * จึงไม่เรียก `syncRichMenuByBookingStatus` แบบเดิม (จะได้เมนูในงานเหมือนเดิม)
 *
 * ลำดับ: RICH_MENU_ID_COMPLETED → RICH_MENU_ID_GUEST → RICH_MENU_ID_CONFIRMED
 * ถ้าไม่ตั้งทั้งสาม → DELETE การผูก per-user เพื่อให้ LINE ใช้ default rich menu ของ OA (เมนู “ต้นฉบับ”)
 */
export async function syncRichMenuAfterSelfCheckout(lineUserId: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (!token) {
    return { ok: false, skipped: true, reason: "LINE_CHANNEL_ACCESS_TOKEN is missing" };
  }

  const pick = (v: string | undefined) => v?.trim() || "";
  const completed = pick(process.env.RICH_MENU_ID_COMPLETED);
  const guest = pick(process.env.RICH_MENU_ID_GUEST);
  const confirmed = pick(process.env.RICH_MENU_ID_CONFIRMED);
  const richMenuId = completed || guest || confirmed || null;

  if (richMenuId) {
    const state = completed ? "completed" : guest ? "guest" : "confirmed";
    try {
      const client = getLineClient();
      await client.linkRichMenuIdToUser(lineUserId, richMenuId);
      return { ok: true, skipped: false as const, action: "linked" as const, state, richMenuId };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown rich menu sync error";
      auditLog("warn", "rich_menu_checkout_sync_failed", { lineUserId, state, richMenuId, reason });
      return { ok: false, skipped: false, reason };
    }
  }

  try {
    const res = await fetch(`https://api.line.me/v2/bot/user/${encodeURIComponent(lineUserId)}/richmenu`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 404) {
      return { ok: true, skipped: true, action: "unlinked" as const, reason: "no_per_user_richmenu" };
    }
    if (!res.ok) {
      const text = await res.text();
      auditLog("warn", "rich_menu_checkout_unlink_failed", { lineUserId, status: res.status, text });
      return { ok: false, reason: text };
    }
    return { ok: true, skipped: false, action: "unlinked" as const };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    auditLog("warn", "rich_menu_checkout_unlink_failed", { lineUserId, reason });
    return { ok: false, reason };
  }
}
