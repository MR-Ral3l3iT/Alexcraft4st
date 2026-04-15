import { broadcastCheckInDisplay, type CheckinDisplayPayload } from "@/lib/checkin-display-broadcast";
import { auditLog } from "@/lib/security/audit";
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

function tokensMatch(provided: string, expected: string): boolean {
  try {
    const a = Buffer.from(provided, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function simulateAllowed(): boolean {
  return process.env.NODE_ENV === "development" || process.env.DISPLAY_SIMULATE_CHECKIN === "true";
}

type SimulateBody = {
  fullName?: string;
  guestNumber?: number;
  drinkCount?: number;
  source?: "self" | "admin";
  pictureUrl?: string | null;
};

/**
 * POST /api/display/simulate-checkin?token=... (หรือ Authorization: Bearer ...)
 * จำลอง event check-in ไปหน้าจอ TV (Socket.IO) โดยไม่แตะ DB
 *
 * เปิดได้เมื่อ NODE_ENV=development หรือ DISPLAY_SIMULATE_CHECKIN=true
 */
export async function POST(request: NextRequest) {
  if (!simulateAllowed()) {
    return NextResponse.json(
      { message: "Simulate disabled — set NODE_ENV=development or DISPLAY_SIMULATE_CHECKIN=true" },
      { status: 403 }
    );
  }

  const secret = process.env.DISPLAY_TV_TOKEN?.trim();
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const q = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  const token = bearer || q;
  if (!secret || !tokensMatch(token, secret)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: SimulateBody = {};
  try {
    const raw = await request.json();
    if (raw && typeof raw === "object") body = raw as SimulateBody;
  } catch {
    /* empty */
  }

  const now = new Date();
  const bookingId = `sim-${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`;

  let guestNumber: number;
  if (typeof body.guestNumber === "number" && Number.isFinite(body.guestNumber) && body.guestNumber > 0) {
    guestNumber = Math.floor(body.guestNumber);
  } else {
    guestNumber = 90_000 + Math.floor(Math.random() * 9_000);
  }

  const payload: CheckinDisplayPayload = {
    fullName: typeof body.fullName === "string" && body.fullName.trim() ? body.fullName.trim() : "Sim check-in",
    pictureUrl: body.pictureUrl === null || body.pictureUrl === undefined ? null : String(body.pictureUrl),
    checkedInAt: now.toISOString(),
    source: body.source === "self" ? "self" : "admin",
    guestNumber,
    drinkCount:
      typeof body.drinkCount === "number" && Number.isFinite(body.drinkCount)
        ? Math.max(0, Math.floor(body.drinkCount))
        : 0,
    bookingId,
    checkedOutAt: null
  };

  broadcastCheckInDisplay(payload);
  auditLog("info", "display_simulate_checkin", { bookingId, guestNumber });

  return NextResponse.json({ ok: true, payload });
}
