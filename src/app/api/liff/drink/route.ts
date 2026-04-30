import { drinkNicknameForCount } from "@/lib/drink-nickname";
import { drinkCooldownRemainingSec } from "@/lib/drink-rules";
import { broadcastCheckInDisplay } from "@/lib/checkin-display-broadcast";
import { getEffectiveEventSettings } from "@/lib/event-settings";
import { buildDrinkMilestoneFlexMessage, drinkMilestoneLevelForCount } from "@/lib/line-flex-drink-milestone";
import { safePushFlexMessage } from "@/lib/line";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/security/audit";
import { rateLimit } from "@/lib/security/rate-limit";
import { sanitizeText } from "@/lib/security/input";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const lineUserId = sanitizeText(request.nextUrl.searchParams.get("lineUserId") ?? "", 120);
  if (!lineUserId) {
    return NextResponse.json({ message: "ต้องระบุ lineUserId", code: "LINE_USER_REQUIRED" }, { status: 400 });
  }

  const [booking, settings] = await Promise.all([
    prisma.booking.findUnique({
      where: { lineUserId },
      select: {
        status: true,
        drinkCount: true,
        drinkLastAt: true,
        bookingCode: true
      }
    }),
    getEffectiveEventSettings()
  ]);

  if (!booking) {
    return NextResponse.json({ message: "ไม่พบการจอง", code: "BOOKING_NOT_FOUND" }, { status: 404 });
  }

  const cooldownRemainingSec = drinkCooldownRemainingSec(
    booking.drinkLastAt,
    settings.drinkCooldownSec
  );
  const atMax =
    settings.drinkMaxPerUser > 0 ? booking.drinkCount >= settings.drinkMaxPerUser : true;
  const canAdd =
    booking.status === "checked_in" && !atMax && cooldownRemainingSec === 0 && settings.drinkMaxPerUser > 0;

  return NextResponse.json({
    status: booking.status,
    bookingCode: booking.bookingCode,
    drinkCount: booking.drinkCount,
    drinkLastAt: booking.drinkLastAt?.toISOString() ?? null,
    drinkCooldownSec: settings.drinkCooldownSec,
    drinkMaxPerUser: settings.drinkMaxPerUser,
    cooldownRemainingSec,
    atMax,
    canAdd,
    nickname: drinkNicknameForCount(booking.drinkCount)
  });
}

type PostBody = { lineUserId?: string };

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const limiter = rateLimit(`liff:drink:${ip}`, 40, 60_000);
  if (!limiter.allowed) {
    return NextResponse.json({ message: "เรียกบ่อยเกินไป กรุณารอสักครู่", code: "RATE_LIMIT" }, { status: 429 });
  }

  const body = (await request.json()) as PostBody;
  const lineUserId = sanitizeText(body.lineUserId ?? "", 120);
  if (!lineUserId) {
    return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ LINE", code: "LINE_USER_REQUIRED" }, { status: 400 });
  }

  const settings = await getEffectiveEventSettings();
  if (settings.drinkMaxPerUser <= 0) {
    return NextResponse.json(
      { message: "ปิดการเติมแก้วชั่วคราว (เพดาน = 0)", code: "DRINK_DISABLED" },
      { status: 400 }
    );
  }

  const cooldownMs = Math.max(0, settings.drinkCooldownSec) * 1000;
  const cooldownCutoff = new Date(Date.now() - cooldownMs);

  const baseWhere = {
    lineUserId,
    status: "checked_in" as const,
    drinkCount: { lt: settings.drinkMaxPerUser }
  };

  const timeWhere =
    settings.drinkCooldownSec <= 0
      ? {}
      : {
          OR: [{ drinkLastAt: null }, { drinkLastAt: { lte: cooldownCutoff } }]
        };

  const updated = await prisma.booking.updateMany({
    where: { ...baseWhere, ...timeWhere },
    data: {
      drinkCount: { increment: 1 },
      drinkLastAt: new Date()
    }
  });

  if (updated.count === 0) {
    const booking = await prisma.booking.findUnique({
      where: { lineUserId },
      select: { status: true, drinkCount: true, drinkLastAt: true, bookingCode: true }
    });
    if (!booking) {
      return NextResponse.json({ message: "ไม่พบการจอง", code: "BOOKING_NOT_FOUND" }, { status: 404 });
    }
    if (booking.status !== "checked_in") {
      return NextResponse.json(
        { message: "เติมแก้วได้หลังเช็คอินเข้างานแล้วเท่านั้น", code: "NOT_CHECKED_IN" },
        { status: 400 }
      );
    }
    if (booking.drinkCount >= settings.drinkMaxPerUser) {
      return NextResponse.json(
        {
          message: `ถึงเพดานแก้วแล้ว (${settings.drinkMaxPerUser} แก้ว)`,
          code: "AT_MAX",
          drinkCount: booking.drinkCount,
          drinkMaxPerUser: settings.drinkMaxPerUser
        },
        { status: 400 }
      );
    }
    const remaining = drinkCooldownRemainingSec(booking.drinkLastAt, settings.drinkCooldownSec);
    return NextResponse.json(
      {
        message: `รอคูลดาวน์อีก ${remaining} วินาที`,
        code: "COOLDOWN",
        cooldownRemainingSec: remaining,
        drinkCooldownSec: settings.drinkCooldownSec
      },
      { status: 400 }
    );
  }

  const fresh = await prisma.booking.findUnique({
    where: { lineUserId },
    select: { id: true, status: true, drinkCount: true, drinkLastAt: true, bookingCode: true }
  });

  if (fresh?.id) {
    const row = await prisma.booking.findUnique({
      where: { id: fresh.id },
      select: {
        fullName: true,
        linePictureUrl: true,
        checkedInAt: true,
        checkedOutAt: true
      }
    });
    if (row && fresh.status === "checked_in" && row.checkedInAt) {
      const baseTime = row.checkedInAt;
      const guestNumber =
        (await prisma.booking.count({
          where: {
            status: "checked_in",
            OR: [
              { checkedInAt: { lt: baseTime } },
              { checkedInAt: baseTime, id: { lte: fresh.id } }
            ]
          }
        })) || 1;

      broadcastCheckInDisplay({
        fullName: row.fullName,
        pictureUrl: row.linePictureUrl,
        checkedInAt: baseTime.toISOString(),
        source: "self",
        guestNumber,
        drinkCount: fresh.drinkCount ?? 0,
        bookingId: fresh.id,
        checkedOutAt: row.checkedOutAt ? row.checkedOutAt.toISOString() : null,
        kind: "drink"
      });
    }
  }

  auditLog("info", "booking_drink_increment", {
    lineUserId,
    bookingCode: fresh?.bookingCode,
    drinkCount: fresh?.drinkCount
  });

  const count = fresh?.drinkCount ?? 0;
  const milestone = drinkMilestoneLevelForCount(count);
  if (milestone !== null) {
    const flex = buildDrinkMilestoneFlexMessage(milestone, count);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Flex payload
    const push = await safePushFlexMessage(lineUserId, flex as Record<string, any>);
    auditLog("info", "drink_milestone_flex", {
      lineUserId,
      bookingCode: fresh?.bookingCode,
      milestone,
      drinkCount: count,
      flexOk: push.ok,
      ...(!push.ok && "reason" in push
        ? { flexReason: String((push as { reason?: unknown }).reason ?? "") }
        : {})
    });
  }

  const cooldownRemainingSec = drinkCooldownRemainingSec(
    fresh?.drinkLastAt ?? null,
    settings.drinkCooldownSec
  );

  const newCount = fresh?.drinkCount ?? 0;

  return NextResponse.json({
    message: "บันทึกเติมแก้วแล้ว",
    status: fresh?.status ?? "checked_in",
    bookingCode: fresh?.bookingCode ?? null,
    drinkCount: newCount,
    drinkLastAt: fresh?.drinkLastAt?.toISOString() ?? null,
    drinkCooldownSec: settings.drinkCooldownSec,
    drinkMaxPerUser: settings.drinkMaxPerUser,
    cooldownRemainingSec,
    atMax: newCount >= settings.drinkMaxPerUser,
    canAdd:
      newCount < settings.drinkMaxPerUser &&
      drinkCooldownRemainingSec(fresh?.drinkLastAt ?? null, settings.drinkCooldownSec) === 0,
    nickname: drinkNicknameForCount(newCount)
  });
}
