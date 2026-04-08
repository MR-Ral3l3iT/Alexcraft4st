import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const [pending, confirmed, checkedIn, total] = await Promise.all([
    prisma.booking.count({ where: { status: { in: ["pending", "waiting_payment_review"] } } }),
    prisma.booking.count({ where: { status: "confirmed" } }),
    prisma.booking.count({ where: { status: "checked_in" } }),
    prisma.booking.count()
  ]);

  return NextResponse.json({ pending, confirmed, checkedIn, total });
}
