import { buildCheckinConfirmedFlexMessage } from "@/lib/line-flex-checkin-confirmed";
import { buildRegistrationConfirmedFlexMessage } from "@/lib/line-flex-registration-confirmed";
import { safePushFlexMessage } from "@/lib/line";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/security/audit";
import { NextRequest, NextResponse } from "next/server";

type FlexKind = "registration" | "checkin";

function parseFlexKind(raw: unknown): FlexKind {
  if (raw === "checkin") return "checkin";
  return "registration";
}

function parseCheckedInAt(raw: unknown): Date | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * POST /api/admin/test-flex
 * body: { bookingId: string, kind?: "registration" | "checkin", checkedInAt?: string (ISO) }
 * รับได้ทั้ง booking id (cuid) หรือ booking code (BK-XXXX)
 * ส่ง Flex message จริงไป LINE แต่ไม่เปลี่ยนสถานะ
 */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    bookingId?: string;
    kind?: unknown;
    checkedInAt?: unknown;
  };
  if (!body.bookingId) {
    return NextResponse.json({ message: "Missing bookingId (รับได้ทั้ง id หรือ booking code เช่น BK-XXXX)" }, { status: 400 });
  }

  const kind = parseFlexKind(body.kind);
  const overrideCheckedInAt = parseCheckedInAt(body.checkedInAt);

  const booking = await prisma.booking.findFirst({
    where: {
      OR: [{ id: body.bookingId }, { bookingCode: body.bookingId }]
    },
    select: { id: true, lineUserId: true, fullName: true, bookingCode: true, checkedInAt: true }
  });
  if (!booking) {
    return NextResponse.json({ message: "Booking not found" }, { status: 404 });
  }

  const bookingCode = booking.bookingCode ?? booking.id;
  const flex =
    kind === "checkin"
      ? buildCheckinConfirmedFlexMessage({
          fullName: booking.fullName,
          bookingCode,
          checkedInAt: overrideCheckedInAt ?? booking.checkedInAt ?? new Date()
        })
      : buildRegistrationConfirmedFlexMessage({
          fullName: booking.fullName,
          bookingCode
        });

  const result = await safePushFlexMessage(booking.lineUserId, flex);
  auditLog("info", "test_flex_sent", { bookingId: booking.id, bookingCode: booking.bookingCode, kind, result });

  if (!result.ok) {
    return NextResponse.json({ message: `ส่งไม่สำเร็จ: ${result.reason}`, result }, { status: 500 });
  }

  return NextResponse.json({ message: "ส่ง Flex message ทดสอบสำเร็จ (ไม่เปลี่ยนสถานะ)", kind, result });
}
