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

type SimulateDrinkBody = {
  bookingId: string;
  fullName: string;
  guestNumber: number;
  drinkCount: number;
  pictureUrl?: string | null;
  checkedInAt?: string;
  source?: "self" | "admin";
  bookingCode?: string | null;
};

/**
 * POST /api/display/simulate-drink?token=...
 * จำลองการเติมแก้วไปหน้าจอ TV (Socket.IO) โดยไม่แตะ DB — payload.kind = "drink"
 *
 * ใช้ทดสอบ glow บนการ์ด: เปิด TV ให้โหลด snapshot ก่อน แล้วยิงด้วย bookingId เดียวกับคนในลิสต์ + drinkCount มากกว่าเดิม
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

  let body: SimulateDrinkBody | null = null;
  try {
    const raw = await request.json();
    if (raw && typeof raw === "object") body = raw as SimulateDrinkBody;
  } catch {
    body = null;
  }

  if (!body?.bookingId?.trim()) {
    return NextResponse.json({ message: "bookingId is required" }, { status: 400 });
  }
  if (!body.fullName?.trim()) {
    return NextResponse.json({ message: "fullName is required" }, { status: 400 });
  }
  if (!Number.isFinite(body.guestNumber) || body.guestNumber <= 0) {
    return NextResponse.json({ message: "guestNumber must be a positive number" }, { status: 400 });
  }
  if (!Number.isFinite(body.drinkCount) || body.drinkCount < 0) {
    return NextResponse.json({ message: "drinkCount must be a non-negative number" }, { status: 400 });
  }

  const checkedInAt =
    typeof body.checkedInAt === "string" && body.checkedInAt.trim()
      ? body.checkedInAt.trim()
      : new Date().toISOString();

  const payload: CheckinDisplayPayload = {
    bookingId: body.bookingId.trim(),
    fullName: body.fullName.trim(),
    pictureUrl: body.pictureUrl === null || body.pictureUrl === undefined ? null : String(body.pictureUrl),
    checkedInAt,
    source: body.source === "admin" ? "admin" : "self",
    guestNumber: Math.floor(body.guestNumber),
    drinkCount: Math.floor(body.drinkCount),
    bookingCode: body.bookingCode?.trim() ? body.bookingCode.trim() : null,
    checkedOutAt: null,
    kind: "drink"
  };

  broadcastCheckInDisplay(payload);
  auditLog("info", "display_simulate_drink", { bookingId: payload.bookingId, drinkCount: payload.drinkCount });

  return NextResponse.json({ ok: true, payload });
}
