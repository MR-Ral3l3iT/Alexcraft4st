import { safePushTextMessage } from "@/lib/line";
import { prisma } from "@/lib/prisma";
import { canTransition } from "@/lib/booking-rules";
import { auditLog } from "@/lib/security/audit";
import { rateLimit } from "@/lib/security/rate-limit";
import { sanitizeText } from "@/lib/security/input";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const limiter = rateLimit(`booking:cancel:${ip}`, 60, 60_000);
  if (!limiter.allowed) {
    return NextResponse.json({ message: "Too many requests" }, { status: 429 });
  }

  const { id: rawId } = await context.params;
  const id = sanitizeText(rawId, 120);
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ message: "Booking not found" }, { status: 404 });
  if (!canTransition(booking.status, "cancelled")) {
    return NextResponse.json(
      { message: `Invalid status transition: ${booking.status} -> cancelled` },
      { status: 400 }
    );
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: { status: "cancelled" }
  });

  await prisma.bookingStatusLog.create({
    data: {
      bookingId: id,
      fromStatus: booking.status,
      toStatus: "cancelled",
      reason: "Admin cancelled booking"
    }
  });

  await safePushTextMessage(
    updated.lineUserId,
    "การจองของคุณถูกยกเลิกแล้ว หากต้องการข้อมูลเพิ่มเติม กรุณาติดต่อแอดมิน"
  );
  auditLog("warn", "booking_cancelled", { bookingId: id, bookingCode: updated.bookingCode });

  return NextResponse.json(updated);
}
