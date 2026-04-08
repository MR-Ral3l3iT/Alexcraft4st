import { generateBookingCode } from "@/lib/booking";
import { prisma } from "@/lib/prisma";
import { EVENT_CONFIG } from "@/config/event";
import { auditLog } from "@/lib/security/audit";
import { rateLimit } from "@/lib/security/rate-limit";
import { sanitizePhone, sanitizeText } from "@/lib/security/input";
import { BookingPayload } from "@/types/booking";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const lineUserId = request.nextUrl.searchParams.get("lineUserId");
  const status = request.nextUrl.searchParams.get("status");
  const q = request.nextUrl.searchParams.get("q");

  if (!lineUserId) {
    const bookings = await prisma.booking.findMany({
      where: {
        status: status ? (status as never) : undefined,
        OR: q
          ? [
              { fullName: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { bookingCode: { contains: q, mode: "insensitive" } }
            ]
          : undefined
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });

    return NextResponse.json(bookings);
  }

  const booking = await prisma.booking.findUnique({
    where: { lineUserId },
    select: {
      id: true,
      bookingCode: true,
      fullName: true,
      phone: true,
      seats: true,
      status: true,
      checkedInAt: true,
      createdAt: true
    }
  });

  if (!booking) {
    return NextResponse.json({ message: "Booking not found" }, { status: 404 });
  }

  return NextResponse.json(booking);
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const limiter = rateLimit(`booking:create:${ip}`, 20, 60_000);
  if (!limiter.allowed) {
    return NextResponse.json({ message: "Too many requests" }, { status: 429 });
  }

  const body = (await request.json()) as BookingPayload;
  const lineUserId = sanitizeText(body.lineUserId, 120);
  const lineDisplay = sanitizeText(body.lineDisplay, 120);
  const fullName = sanitizeText(body.fullName, 120);
  const phone = sanitizePhone(body.phone);
  const note = sanitizeText(body.note, 500);
  const slipUrl = sanitizeText(body.slipUrl, 500);
  const seats = Number(body.seats);

  if (!lineUserId || !fullName || !phone || !seats) {
    return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
  }

  if (seats < 1) {
    return NextResponse.json({ message: "Seats must be at least 1" }, { status: 400 });
  }

  const existing = await prisma.booking.findUnique({ where: { lineUserId } });
  if (existing) {
    return NextResponse.json(
      { message: "LINE user already has a booking", bookingId: existing.id },
      { status: 409 }
    );
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const aggregated = await tx.booking.aggregate({
        where: {
          status: { in: ["confirmed", "checked_in", "waiting_payment_review"] }
        },
        _sum: { seats: true }
      });

      const reservedSeats = aggregated._sum.seats ?? 0;
      if (reservedSeats + seats > EVENT_CONFIG.capacity) {
        throw new Error("CAPACITY_EXCEEDED");
      }

      const booking = await tx.booking.create({
        data: {
          lineUserId,
          lineDisplay,
          fullName,
          phone,
          seats,
          note: note || undefined,
          slipUrl: slipUrl || undefined,
          status: slipUrl ? "waiting_payment_review" : "pending",
          bookingCode: generateBookingCode(),
          qrCodePayload: `lineUserId:${lineUserId}`
        }
      });

      await tx.bookingStatusLog.create({
        data: {
          bookingId: booking.id,
          fromStatus: null,
          toStatus: booking.status,
          reason: "Initial registration"
        }
      });

      return booking;
    });
    auditLog("info", "booking_created", { bookingId: created.id, lineUserId, seats });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "CAPACITY_EXCEEDED") {
      return NextResponse.json({ message: "Event seats are full" }, { status: 409 });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: "Duplicate unique value" }, { status: 409 });
    }

    return NextResponse.json({ message: "Cannot create booking" }, { status: 500 });
  }
}
