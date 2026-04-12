import { syncRichMenuByBookingStatus } from "@/lib/line-richmenu";
import { safePushTextMessage } from "@/lib/line";
import { prisma } from "@/lib/prisma";
import { canTransition } from "@/lib/booking-rules";
import { auditLog } from "@/lib/security/audit";
import { rateLimit } from "@/lib/security/rate-limit";
import { sanitizeText } from "@/lib/security/input";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const SLIP_UPLOAD_PREFIX = "/uploads/slips/";

function resolveSlipPath(slipUrl: string): string | null {
  if (!slipUrl.startsWith(SLIP_UPLOAD_PREFIX)) return null;
  const filename = path.basename(slipUrl);
  return path.join(process.cwd(), "public", "uploads", "slips", filename);
}

async function removeSlipFile(slipUrl: string): Promise<void> {
  const absolutePath = resolveSlipPath(slipUrl);
  if (!absolutePath) return;
  try {
    await unlink(absolutePath);
  } catch {
    // ignore
  }
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const limiter = rateLimit(`booking:reject-slip:${ip}`, 60, 60_000);
  if (!limiter.allowed) {
    return NextResponse.json({ message: "Too many requests" }, { status: 429 });
  }

  const { id: rawId } = await context.params;
  const id = sanitizeText(rawId, 120);
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ message: "Booking not found" }, { status: 404 });
  if (booking.status !== "waiting_payment_review" || !canTransition(booking.status, "pending")) {
    return NextResponse.json(
      { message: "ปฏิเสธสลิปได้เฉพาะรายการที่สถานะรอตรวจสอบชำระเงินเท่านั้น" },
      { status: 400 }
    );
  }

  const previousSlip = booking.slipUrl;
  const updated = await prisma.booking.update({
    where: { id },
    data: { status: "pending", slipUrl: null }
  });

  if (previousSlip) {
    await removeSlipFile(previousSlip);
  }

  await prisma.bookingStatusLog.create({
    data: {
      bookingId: id,
      fromStatus: booking.status,
      toStatus: "pending",
      reason: "Admin rejected payment slip"
    }
  });

  await safePushTextMessage(
    updated.lineUserId,
    "สลิปการโอนไม่ผ่านการตรวจสอบ กรุณาอัปโหลดสลิปใหม่อีกครั้งจากหน้าจองของคุณ"
  );
  await syncRichMenuByBookingStatus(updated.lineUserId, updated.status);
  auditLog("warn", "booking_slip_rejected", { bookingId: id, bookingCode: updated.bookingCode });

  return NextResponse.json(updated);
}
