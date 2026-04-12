import { syncRichMenuByBookingStatus } from "@/lib/line-richmenu";
import { safePushFlexMessage } from "@/lib/line";
import { buildRegistrationConfirmedFlexMessage } from "@/lib/line-flex-registration-confirmed";
import { prisma } from "@/lib/prisma";
import { canTransition } from "@/lib/booking-rules";
import { auditLog } from "@/lib/security/audit";
import { rateLimit } from "@/lib/security/rate-limit";
import { sanitizeText } from "@/lib/security/input";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const limiter = rateLimit(`booking:approve:${ip}`, 60, 60_000);
  if (!limiter.allowed) {
    return NextResponse.json({ message: "Too many requests" }, { status: 429 });
  }

  const { id: rawId } = await context.params;
  const id = sanitizeText(rawId, 120);
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ message: "Booking not found" }, { status: 404 });
  if (!canTransition(booking.status, "confirmed")) {
    return NextResponse.json(
      { message: `Invalid status transition: ${booking.status} -> confirmed` },
      { status: 400 }
    );
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: { status: "confirmed" }
  });

  await prisma.bookingStatusLog.create({
    data: {
      bookingId: id,
      fromStatus: booking.status,
      toStatus: "confirmed",
      reason: "Admin approved booking"
    }
  });

  const bookingCode = updated.bookingCode ?? id;
  const flexMessage = buildRegistrationConfirmedFlexMessage({
    fullName: updated.fullName,
    bookingCode
  });
  await safePushFlexMessage(updated.lineUserId, flexMessage);

  await syncRichMenuByBookingStatus(updated.lineUserId, updated.status);
  auditLog("info", "booking_approved", { bookingId: id, bookingCode });

  return NextResponse.json(updated);
}
