import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      statusLogs: { orderBy: { createdAt: "desc" }, take: 10 },
      checkinLogs: { orderBy: { createdAt: "desc" }, take: 10 }
    }
  });

  if (!booking) {
    return NextResponse.json({ message: "Booking not found" }, { status: 404 });
  }

  return NextResponse.json(booking);
}
