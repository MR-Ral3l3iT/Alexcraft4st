import { buildCheckinConfirmedFlexMessage } from "@/lib/line-flex-checkin-confirmed";
import { buildDrinkMilestoneFlexMessage, type DrinkMilestoneLevel } from "@/lib/line-flex-drink-milestone";
import { buildRegistrationConfirmedFlexMessage } from "@/lib/line-flex-registration-confirmed";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type FlexKind = "registration" | "checkin" | "drink_milestone";

function parseFlexKind(raw: string | null): FlexKind | null {
  if (raw == null || raw === "" || raw === "registration") return "registration";
  if (raw === "checkin") return "checkin";
  if (raw === "drink_milestone" || raw === "drink") return "drink_milestone";
  return null;
}

function parseDrinkMilestoneLevel(raw: string | null): DrinkMilestoneLevel | null {
  if (raw === "2") return 2;
  if (raw === "3") return 3;
  if (raw === "1" || raw == null || raw === "") return 1;
  return null;
}

/**
 * GET /api/admin/preview-flex?bookingId=xxx[&kind=registration|checkin]
 * GET /api/admin/preview-flex?kind=drink_milestone&level=1[&drinkCount=3] — ไม่ต้องส่ง bookingId
 * รับได้ทั้ง booking id (cuid) หรือ booking code (BK-XXXX) เมื่อ kind เป็น registration|checkin
 * คืน Flex JSON สำหรับ copy ไปวางที่ LINE Flex Message Simulator
 * ไม่ส่งข้อความจริง ไม่เปลี่ยนสถานะ
 */
export async function GET(request: NextRequest) {
  const kindEarly = parseFlexKind(request.nextUrl.searchParams.get("kind"));
  if (kindEarly === "drink_milestone") {
    const level = parseDrinkMilestoneLevel(request.nextUrl.searchParams.get("level"));
    if (level === null) {
      return NextResponse.json({ message: "Invalid level (ใช้ 1, 2 หรือ 3)" }, { status: 400 });
    }
    const rawCount = request.nextUrl.searchParams.get("drinkCount");
    const parsed = rawCount == null || rawCount === "" ? NaN : Number(rawCount);
    const drinkCount = Number.isFinite(parsed)
      ? Math.max(0, Math.floor(parsed))
      : level === 1
        ? 3
        : level === 2
          ? 6
          : 10;
    const flex = buildDrinkMilestoneFlexMessage(level, drinkCount);
    return NextResponse.json({
      kind: "drink_milestone",
      level,
      drinkCount,
      instruction:
        "คัดลอก contentsOnly ไปวางที่ LINE Flex Message Simulator: https://developers.line.biz/flex-simulator/",
      flexMessage: flex,
      contentsOnly: flex.contents
    });
  }

  const raw = request.nextUrl.searchParams.get("bookingId");
  if (!raw) {
    return NextResponse.json(
      {
        message:
          "Missing bookingId (รับได้ทั้ง id หรือ booking code เช่น BK-XXXX) — หรือใช้ ?kind=drink_milestone&level=1"
      },
      { status: 400 }
    );
  }

  const kind = parseFlexKind(request.nextUrl.searchParams.get("kind"));
  if (!kind) {
    return NextResponse.json(
      { message: "Invalid kind (ใช้ registration, checkin หรือ drink_milestone)" },
      { status: 400 }
    );
  }

  const booking = await prisma.booking.findFirst({
    where: {
      OR: [{ id: raw }, { bookingCode: raw }]
    },
    select: { id: true, fullName: true, bookingCode: true, checkedInAt: true }
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
          checkedInAt: booking.checkedInAt ?? new Date()
        })
      : buildRegistrationConfirmedFlexMessage({
          fullName: booking.fullName,
          bookingCode
        });

  return NextResponse.json({
    kind,
    instruction:
      "คัดลอก contentsOnly ไปวางที่ LINE Flex Message Simulator: https://developers.line.biz/flex-simulator/",
    flexMessage: flex,
    contentsOnly: flex.contents
  }, { status: 200 });
}
