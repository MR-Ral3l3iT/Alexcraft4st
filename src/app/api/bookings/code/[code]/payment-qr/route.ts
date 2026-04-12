import { buildPaymentRequest } from "@/lib/payment";
import { getEffectiveEventSettings } from "@/lib/event-settings";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import { sanitizeText } from "@/lib/security/input";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ code: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const limiter = rateLimit(`booking:regen-payment-qr:${ip}`, 20, 60_000);
  if (!limiter.allowed) {
    return NextResponse.json({ message: "Too many requests" }, { status: 429 });
  }

  const { code: rawCode } = await context.params;
  const code = sanitizeText(rawCode, 120);

  const booking = await prisma.booking.findUnique({ where: { bookingCode: code } });
  if (!booking) {
    return NextResponse.json({ message: "Booking code not found" }, { status: 404 });
  }
  if (booking.status === "cancelled" || booking.status === "checked_in") {
    return NextResponse.json({ message: "Cannot regenerate payment QR for this booking status" }, { status: 400 });
  }

  const settings = await getEffectiveEventSettings();
  const payment = buildPaymentRequest({
    bookingCode: booking.bookingCode ?? booking.id,
    lineUserId: booking.lineUserId,
    paymentAmount: settings.paymentAmountThb,
    accountNo: settings.paymentAccountNo
  });

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      paymentAmount: payment.paymentAmount,
      paymentRef: payment.paymentRef,
      paymentQrPayload: payment.paymentQrPayload,
      paymentQrImageUrl: payment.paymentQrImageUrl,
      paymentRequestedAt: payment.paymentRequestedAt,
      paymentExpiresAt: payment.paymentExpiresAt
    },
    select: {
      bookingCode: true,
      paymentAmount: true,
      paymentRef: true,
      paymentQrPayload: true,
      paymentQrImageUrl: true,
      paymentRequestedAt: true,
      paymentExpiresAt: true
    }
  });

  return NextResponse.json(updated);
}
