import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ code: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { code } = await context.params;
  const booking = await prisma.booking.findUnique({
    where: { bookingCode: code },
    select: {
      id: true,
      bookingCode: true,
      fullName: true,
      seats: true,
      status: true,
      checkedInAt: true,
      qrCodePayload: true,
      paymentAmount: true,
      paymentRef: true,
      paymentQrPayload: true,
      paymentQrImageUrl: true,
      paymentRequestedAt: true,
      paymentExpiresAt: true,
      slipUrl: true
    }
  });

  if (!booking) {
    return NextResponse.json({ message: "Booking code not found" }, { status: 404 });
  }

  return NextResponse.json(booking);
}
