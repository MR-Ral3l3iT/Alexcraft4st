import { generateBookingCode } from "@/lib/booking";
import { prisma } from "@/lib/prisma";
import { getEffectiveEventSettings } from "@/lib/event-settings";
import { auditLog } from "@/lib/security/audit";
import { rateLimit } from "@/lib/security/rate-limit";
import { sanitizePhone, sanitizeText } from "@/lib/security/input";
import { BookingPayload } from "@/types/booking";
import { buildPaymentRequest } from "@/lib/payment";
import { syncRichMenuByBookingStatus } from "@/lib/line-richmenu";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const lineUserId = request.nextUrl.searchParams.get("lineUserId");
  const status = request.nextUrl.searchParams.get("status");
  const q = request.nextUrl.searchParams.get("q");

  if (!lineUserId) {
    const rawPage = request.nextUrl.searchParams.get("page");
    const rawPageSize = request.nextUrl.searchParams.get("pageSize");
    const pageSize = Math.min(Math.max(Number.parseInt(rawPageSize ?? "20", 10) || 20, 1), 100);
    const page = Math.max(Number.parseInt(rawPage ?? "1", 10) || 1, 1);
    const skip = (page - 1) * pageSize;

    const where: Prisma.BookingWhereInput = {
      ...(status ? { status: status as never } : {}),
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { bookingCode: { contains: q, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize
      }),
      prisma.booking.count({ where })
    ]);

    return NextResponse.json({ bookings, total, page, pageSize });
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
      createdAt: true,
      lineDisplay: true,
      linePictureUrl: true
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
  const linePictureUrl = sanitizeText(body.linePictureUrl, 500);
  const fullName = sanitizeText(body.fullName, 120);
  const phone = sanitizePhone(body.phone);
  const note = sanitizeText(body.note, 500);
  const slipUrl = sanitizeText(body.slipUrl, 500);
  // Business rule: 1 LINE ID can book exactly 1 seat.
  const seats = 1;

  if (!lineUserId || !fullName || !phone) {
    return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
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
      const settings = await getEffectiveEventSettings(tx);
      const aggregated = await tx.booking.aggregate({
        where: {
          status: { in: ["confirmed", "checked_in", "waiting_payment_review"] }
        },
        _sum: { seats: true }
      });

      const reservedSeats = aggregated._sum.seats ?? 0;
      if (reservedSeats + seats > settings.capacity) {
        throw new Error("CAPACITY_EXCEEDED");
      }

      const bookingCode = generateBookingCode();
      const payment = buildPaymentRequest({
        bookingCode,
        lineUserId,
        paymentAmount: settings.paymentAmountThb,
        accountNo: settings.paymentAccountNo
      });

      const booking = await tx.booking.create({
        data: {
          lineUserId,
          lineDisplay,
          linePictureUrl: linePictureUrl || undefined,
          fullName,
          phone,
          seats,
          note: note || undefined,
          slipUrl: slipUrl || undefined,
          status: slipUrl ? "waiting_payment_review" : "pending",
          bookingCode,
          paymentAmount: payment.paymentAmount,
          paymentRef: payment.paymentRef,
          paymentQrPayload: payment.paymentQrPayload,
          paymentQrImageUrl: payment.paymentQrImageUrl,
          paymentRequestedAt: payment.paymentRequestedAt,
          paymentExpiresAt: payment.paymentExpiresAt,
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
    await syncRichMenuByBookingStatus(created.lineUserId, created.status);

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
