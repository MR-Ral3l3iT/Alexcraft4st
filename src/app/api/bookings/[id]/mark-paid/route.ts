import { prisma } from "@/lib/prisma";
import { canTransition } from "@/lib/booking-rules";
import { syncRichMenuByBookingStatus } from "@/lib/line-richmenu";
import { auditLog } from "@/lib/security/audit";
import { rateLimit } from "@/lib/security/rate-limit";
import { sanitizeText } from "@/lib/security/input";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const limiter = rateLimit(`booking:mark-paid:${ip}`, 60, 60_000);
  if (!limiter.allowed) {
    return NextResponse.json({ message: "Too many requests" }, { status: 429 });
  }

  const { id: rawId } = await context.params;
  const id = sanitizeText(rawId, 120);
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ message: "Booking not found" }, { status: 404 });
  if (!canTransition(booking.status, "waiting_payment_review")) {
    return NextResponse.json(
      { message: `Invalid status transition: ${booking.status} -> waiting_payment_review` },
      { status: 400 }
    );
  }

  const updated = await prisma.booking.update({ where: { id }, data: { status: "waiting_payment_review" } });

  await prisma.bookingStatusLog.create({
    data: {
      bookingId: id,
      fromStatus: booking.status,
      toStatus: "waiting_payment_review",
      reason: "Admin marked payment as received"
    }
  });
  await syncRichMenuByBookingStatus(updated.lineUserId, updated.status);
  auditLog("info", "booking_mark_paid", { bookingId: id, bookingCode: updated.bookingCode });

  return NextResponse.json(updated);
}
