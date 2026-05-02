import { getEffectiveEventSettings } from "@/lib/event-settings";
import { prisma } from "@/lib/prisma";
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

function tokensMatch(provided: string, expected: string): boolean {
  try {
    const a = Buffer.from(provided, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export type CheckinSnapshotGuest = {
  bookingId: string;
  bookingCode: string | null;
  fullName: string;
  pictureUrl: string | null;
  checkedInAt: string;
  guestNumber: number;
  drinkCount: number;
  checkedOutAt: string | null;
};

/**
 * GET /api/display/checkin-snapshot?token=...
 * โหลดรายชื่อผู้เช็คอิน + capacity สำหรับหน้าจอ TV (ต้องใช้ DISPLAY_TV_TOKEN เดียวกับหน้า /display/checkin)
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  const secret = process.env.DISPLAY_TV_TOKEN?.trim();
  if (!secret || !tokensMatch(token, secret)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const settings = await getEffectiveEventSettings();
  const rows = await prisma.booking.findMany({
    where: { status: "checked_in" },
    orderBy: { checkedInAt: "asc" },
    select: {
      id: true,
      bookingCode: true,
      fullName: true,
      linePictureUrl: true,
      checkedInAt: true,
      drinkCount: true,
      checkedOutAt: true
    }
  });

  const guests: CheckinSnapshotGuest[] = rows.map((r, i) => ({
    bookingId: r.id,
    bookingCode: r.bookingCode ?? null,
    fullName: r.fullName,
    pictureUrl: r.linePictureUrl,
    checkedInAt: (r.checkedInAt ?? new Date()).toISOString(),
    guestNumber: i + 1,
    drinkCount: r.drinkCount ?? 0,
    checkedOutAt: r.checkedOutAt ? r.checkedOutAt.toISOString() : null
  }));

  const checkedInCount = guests.length;
  const guestsNewestFirst = [...guests].reverse();

  return NextResponse.json({
    capacity: settings.capacity,
    checkedInCount,
    guests: guestsNewestFirst
  });
}
