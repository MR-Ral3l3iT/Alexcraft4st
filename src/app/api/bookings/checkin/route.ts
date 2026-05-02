import { broadcastCheckInDisplay } from "@/lib/checkin-display-broadcast";
import { buildCheckinConfirmedFlexMessage } from "@/lib/line-flex-checkin-confirmed";
import { safePushFlexMessage } from "@/lib/line";
import { syncRichMenuByBookingStatus } from "@/lib/line-richmenu";
import { prisma } from "@/lib/prisma";
import { canTransition } from "@/lib/booking-rules";
import { auditLog } from "@/lib/security/audit";
import { rateLimit } from "@/lib/security/rate-limit";
import { sanitizeText } from "@/lib/security/input";
import { NextRequest, NextResponse } from "next/server";

type CheckinBody = {
  q?: string;
  bookingId?: string;
};

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const limiter = rateLimit(`checkin:${ip}`, 30, 60_000);
  if (!limiter.allowed) {
    return NextResponse.json({ message: "Too many requests" }, { status: 429 });
  }

  const body = (await request.json()) as CheckinBody;
  const search = sanitizeText(body.q, 120);
  const bookingId = sanitizeText(body.bookingId, 120);

  let booking =
    bookingId
      ? await prisma.booking.findUnique({ where: { id: bookingId } })
      : search
        ? await prisma.booking.findFirst({
            where: {
              OR: [{ bookingCode: search }, { phone: search }, { fullName: { contains: search, mode: "insensitive" } }]
            }
          })
        : null;

  if (!booking) {
    return NextResponse.json({ message: "Booking not found" }, { status: 404 });
  }

  if (booking.status === "checked_in") {
    return NextResponse.json({ message: "Booking already checked in", booking }, { status: 409 });
  }

  if (!canTransition(booking.status, "checked_in")) {
    return NextResponse.json({ message: "Only confirmed booking can check in", booking }, { status: 400 });
  }

  const now = new Date();
  const updated = await prisma.booking.updateMany({
    where: { id: booking.id, status: "confirmed" },
    data: { status: "checked_in", checkedInAt: now }
  });
  if (updated.count === 0) {
    const latest = await prisma.booking.findUnique({ where: { id: booking.id } });
    return NextResponse.json({ message: "Booking already checked in", booking: latest }, { status: 409 });
  }
  booking = (await prisma.booking.findUnique({ where: { id: booking.id } })) ?? booking;

  await prisma.checkinLog.create({
    data: {
      bookingId: booking.id,
      method: body.bookingId ? "select" : "search"
    }
  });

  await prisma.bookingStatusLog.create({
    data: {
      bookingId: booking.id,
      fromStatus: "confirmed",
      toStatus: "checked_in",
      reason: "Onsite check-in"
    }
  });

  const flex = buildCheckinConfirmedFlexMessage({
    fullName: booking.fullName,
    bookingCode: booking.bookingCode ?? booking.id,
    checkedInAt: booking.checkedInAt ?? now
  });
  await safePushFlexMessage(booking.lineUserId, flex);
  await syncRichMenuByBookingStatus(booking.lineUserId, booking.status);
  const guestNumber = await prisma.booking.count({ where: { status: "checked_in" } });
  broadcastCheckInDisplay({
    fullName: booking.fullName,
    pictureUrl: booking.linePictureUrl ?? null,
    checkedInAt: (booking.checkedInAt ?? now).toISOString(),
    source: "admin",
    guestNumber,
    drinkCount: booking.drinkCount ?? 0,
    bookingId: booking.id,
    bookingCode: booking.bookingCode ?? null,
    checkedOutAt: booking.checkedOutAt ? booking.checkedOutAt.toISOString() : null
  });
  auditLog("info", "booking_checked_in", { bookingId: booking.id, bookingCode: booking.bookingCode });

  return NextResponse.json({ message: "Checked in successfully", booking });
}
