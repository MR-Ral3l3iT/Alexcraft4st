#!/usr/bin/env node
/**
 * Manually link a per-user rich menu (for testing / fixing users stuck on default).
 *
 * Usage:
 *   npm run line:richmenu:link -- Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx <richMenuId>
 *
 * หรือระบุสถานะ (อ่าน id จาก .env):
 *   npm run line:richmenu:link -- Uxxx --pending
 *   npm run line:richmenu:link -- Uxxx --confirmed
 *   npm run line:richmenu:link -- Uxxx --checked-in
 *   npm run line:richmenu:link -- Uxxx --guest
 *   npm run line:richmenu:link -- Uxxx --unlink   (ถอดเมนู per-user → กลับไปใช้ default ใน OA Manager)
 *   npm run line:richmenu:link -- Uxxx --show     (ดู richMenuId ที่ผูกกับ user นี้อยู่ — ต้องเป็น lineUserId จริง)
 *
 * (แบบเดิม) ใส่แค่ userId เดียว = ใช้ RICH_MENU_ID_PENDING — อาจทำให้สับสนเมื่ออยากทดสอบเมนู confirmed
 */

/** ตัวอย่างใน docs — ไม่ใช่ user จริง */
const PLACEHOLDER_USER_IDS = new Set(["U1234567890abcdef1234567890abcdef"]);

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..");

function loadDotEnv() {
  const envPath = path.join(repoRoot, ".env");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function resolveRichMenuIdFromArgs(argv, env) {
  const rest = argv.slice(2).filter(Boolean);
  const flags = new Set();
  const positional = [];
  for (const a of rest) {
    if (a === "--pending") flags.add("pending");
    else if (a === "--confirmed") flags.add("confirmed");
    else if (a === "--checked-in" || a === "--checked_in") flags.add("checked_in");
    else if (a === "--guest") flags.add("guest");
    else if (a === "--unlink") flags.add("unlink");
    else if (a === "--show") flags.add("show");
    else if (a === "--cancelled") flags.add("cancelled");
    else if (a === "--waiting-payment" || a === "--waiting_payment") flags.add("waiting_payment");
    else positional.push(a);
  }

  const userId = positional[0] || "";
  let richMenuId = positional[1] || "";

  if (!richMenuId && !flags.has("unlink") && !flags.has("show")) {
    if (flags.has("guest")) richMenuId = env.RICH_MENU_ID_GUEST || "";
    else if (flags.has("confirmed")) richMenuId = env.RICH_MENU_ID_CONFIRMED || "";
    else if (flags.has("checked_in")) richMenuId = env.RICH_MENU_ID_CHECKED_IN || "";
    else if (flags.has("cancelled")) richMenuId = env.RICH_MENU_ID_CANCELLED || "";
    else if (flags.has("waiting_payment")) {
      richMenuId = env.RICH_MENU_ID_WAITING_PAYMENT || env.RICH_MENU_ID_PENDING || "";
    } else if (flags.has("pending")) {
      richMenuId = env.RICH_MENU_ID_PENDING || "";
    } else {
      richMenuId = env.RICH_MENU_ID_PENDING || "";
    }
  }

  const flagHint =
    flags.size > 0
      ? [...flags].join(",")
      : positional[1]
        ? "explicit-id"
        : "default-pending";
  return {
    userId,
    richMenuId,
    flagHint,
    unlink: flags.has("unlink"),
    show: flags.has("show")
  };
}

async function main() {
  loadDotEnv();
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.error("Missing LINE_CHANNEL_ACCESS_TOKEN in .env");
    process.exit(1);
  }

  const { userId, richMenuId, flagHint, unlink, show } = resolveRichMenuIdFromArgs(process.argv, process.env);

  if (!userId || !userId.startsWith("U")) {
    console.error("Usage: npm run line:richmenu:link -- <lineUserId> [richMenuId]");
    console.error("  or: npm run line:richmenu:link -- <lineUserId> --confirmed");
    console.error("  lineUserId must look like U + 32 hex chars (from LINE / booking DB)");
    process.exit(1);
  }

  if (PLACEHOLDER_USER_IDS.has(userId)) {
    console.error("ค่า userId นี้เป็นตัวอย่างในเอกสารเท่านั้น — ไม่ใช่บัญชี LINE ของคุณ");
    console.error("หา lineUserId จริง: จาก webhook / หน้า admin เมื่อมีจอง / หรือรัน --show หลังใส่ id ที่ได้จาก LINE");
    process.exit(1);
  }

  if (show) {
    const res = await fetch(`https://api.line.me/v2/bot/user/${encodeURIComponent(userId)}/richmenu`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const text = await res.text();
    if (res.status === 404) {
      console.log("user", userId, "→ ไม่มี per-user rich menu ผูกอยู่ (ใช้ default ของ OA แล้ว)");
      return;
    }
    if (!res.ok) {
      console.error("GET rich menu failed:", res.status, text);
      process.exit(1);
    }
    try {
      const j = JSON.parse(text);
      console.log("user", userId, "→ richMenuId ที่ผูกอยู่:", j.richMenuId ?? text);
    } catch {
      console.log("user", userId, "→", text);
    }
    return;
  }

  if (unlink) {
    const res = await fetch(`https://api.line.me/v2/bot/user/${encodeURIComponent(userId)}/richmenu`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("Unlink failed:", res.status, text);
      process.exit(1);
    }
    console.log("Unlinked per-user rich menu for", userId, "→ LINE จะใช้ default rich menu ของ OA");
    console.log("Re-open the chat in LINE; pull down to refresh if needed.");
    return;
  }

  if (!richMenuId) {
    console.error("Provide richMenuId as second arg, or a flag: --guest | --pending | --confirmed | --checked-in");
    console.error("  and set the matching RICH_MENU_ID_* in .env");
    process.exit(1);
  }

  const res = await fetch(
    `https://api.line.me/v2/bot/user/${encodeURIComponent(userId)}/richmenu/${encodeURIComponent(richMenuId)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  const text = await res.text();
  if (!res.ok) {
    console.error("Link failed:", res.status, text);
    process.exit(1);
  }
  console.log("Linked rich menu", richMenuId, "to user", userId, `(${flagHint})`);
  console.log("Re-open the chat in LINE; pull down to refresh if needed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
