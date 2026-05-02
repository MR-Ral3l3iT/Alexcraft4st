import { canTransition } from "@/lib/booking-rules";
import {
  formatCheckinOpensAtTh,
  formatThaiRemaining,
  remainingUntil
} from "@/lib/checkin-response";
import { broadcastCheckInDisplay } from "@/lib/checkin-display-broadcast";
import { getEffectiveEventSettings } from "@/lib/event-settings";
import { buildCheckinConfirmedFlexMessage } from "@/lib/line-flex-checkin-confirmed";
import { safePushFlexMessage } from "@/lib/line";
import { syncRichMenuByBookingStatus } from "@/lib/line-richmenu";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/security/audit";
import { rateLimit } from "@/lib/security/rate-limit";
import { sanitizeText } from "@/lib/security/input";
import { NextRequest, NextResponse } from "next/server";

type SelfCheckinBody = {
  lineUserId?: string;
  lat?: number;
  lng?: number;
};

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadiusM = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusM * c;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const limiter = rateLimit(`booking:self-checkin:${ip}`, 20, 60_000);
  if (!limiter.allowed) {
    return NextResponse.json({ message: "Too many requests" }, { status: 429 });
  }

  const body = (await request.json()) as SelfCheckinBody;
  const lineUserId = sanitizeText(body.lineUserId, 120);
  const lat = Number(body.lat);
  const lng = Number(body.lng);

  if (!lineUserId) {
    return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ LINE ก่อนเช็คอิน", code: "LINE_USER_REQUIRED" }, { status: 400 });
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { message: "พิกัดตำแหน่งไม่ถูกต้อง กรุณาเปิดสิทธิ์ตำแหน่งแล้วลองใหม่", code: "INVALID_COORDINATES" },
      { status: 400 }
    );
  }

  const booking = await prisma.booking.findUnique({ where: { lineUserId } });
  if (!booking) {
    return NextResponse.json({ message: "ไม่พบการจองสำหรับบัญชี LINE นี้", code: "BOOKING_NOT_FOUND" }, { status: 404 });
  }
  if (booking.status === "checked_in") {
    return NextResponse.json({
      message: "คุณเช็คอินแล้ว",
      code: "ALREADY_CHECKED_IN",
      alreadyCheckedIn: true,
      booking
    });
  }
  if (!canTransition(booking.status, "checked_in")) {
    return NextResponse.json(
      {
        message: "เช็คอินได้เฉพาะการจองที่อนุมัติแล้ว (สถานะ confirmed) เท่านั้น",
        code: "INVALID_STATUS"
      },
      { status: 400 }
    );
  }

  const settings = await getEffectiveEventSettings();
  if (settings.venueLat === null || settings.venueLng === null) {
    return NextResponse.json(
      {
        message:
          "ยังไม่ได้ตั้งค่าพิกัดจุดจัดงาน กรุณาติดต่อแอดมินเพื่อเช็คอินหน้างาน",
        code: "VENUE_NOT_CONFIGURED"
      },
      { status: 400 }
    );
  }

  const now = new Date();
  if (settings.checkinStartAt && now < settings.checkinStartAt) {
    const opensAt = settings.checkinStartAt;
    const parts = remainingUntil(opensAt, now);
    const countdown = formatThaiRemaining(parts);
    const opensAtFormattedTh = formatCheckinOpensAtTh(opensAt);
    return NextResponse.json(
      {
        message: `ยังไม่ถึงเวลาเช็คอิน ระบบจะเปิดให้เช็คอินเมื่อ ${opensAtFormattedTh} (เหลืออีกประมาณ ${countdown})`,
        code: "CHECKIN_NOT_OPEN",
        checkinOpensAt: opensAt.toISOString(),
        checkinOpensAtFormattedTh: opensAtFormattedTh,
        remaining: parts
      },
      { status: 400 }
    );
  }
  if (settings.checkinEndAt && now > settings.checkinEndAt) {
    return NextResponse.json(
      {
        message: "ช่วงเวลาเช็คอินปิดแล้ว กรุณาติดต่อทีมงานหน้างาน",
        code: "CHECKIN_CLOSED"
      },
      { status: 400 }
    );
  }

  const distance = haversineDistanceMeters(lat, lng, settings.venueLat, settings.venueLng);
  const distanceRounded = Math.round(distance);
  if (distance > settings.checkinRadiusM) {
    return NextResponse.json(
      {
        message: `คุณอยู่นอกเขตลงทะเบียนเข้างาน (ระยะจากจุดจัดงานประมาณ ${distanceRounded} เมตร เกินรัศมีที่อนุญาต ${settings.checkinRadiusM} เมตร) กรุณาเข้าใกล้จุดจัดงานหรือติดต่อแอดมินเพื่อเช็คอินแบบ manual`,
        code: "OUTSIDE_CHECKIN_AREA",
        distanceMeters: distanceRounded,
        radiusMeters: settings.checkinRadiusM
      },
      { status: 400 }
    );
  }

  const updated = await prisma.booking.updateMany({
    where: { id: booking.id, status: "confirmed" },
    data: { status: "checked_in", checkedInAt: now }
  });
  if (updated.count === 0) {
    const latest = await prisma.booking.findUnique({ where: { id: booking.id } });
    return NextResponse.json({
      message: "คุณเช็คอินแล้ว",
      code: "ALREADY_CHECKED_IN",
      booking: latest,
      alreadyCheckedIn: true
    });
  }

  const latest = await prisma.booking.findUnique({ where: { id: booking.id } });
  await prisma.checkinLog.create({
    data: {
      bookingId: booking.id,
      method: "self-liff"
    }
  });
  await prisma.bookingStatusLog.create({
    data: {
      bookingId: booking.id,
      fromStatus: "confirmed",
      toStatus: "checked_in",
      reason: `Self check-in via LIFF at ${lat},${lng} (${distanceRounded}m)`
    }
  });

  if (latest) {
    const flex = buildCheckinConfirmedFlexMessage({
      fullName: latest.fullName,
      bookingCode: latest.bookingCode ?? latest.id,
      checkedInAt: latest.checkedInAt ?? now
    });
    await safePushFlexMessage(booking.lineUserId, flex);
    await syncRichMenuByBookingStatus(booking.lineUserId, latest.status);
    const guestNumber = await prisma.booking.count({ where: { status: "checked_in" } });
    broadcastCheckInDisplay({
      fullName: latest.fullName,
      pictureUrl: latest.linePictureUrl ?? null,
      checkedInAt: (latest.checkedInAt ?? now).toISOString(),
      source: "self",
      guestNumber,
      drinkCount: latest.drinkCount ?? 0,
      bookingId: latest.id,
      bookingCode: latest.bookingCode ?? null,
      checkedOutAt: latest.checkedOutAt ? latest.checkedOutAt.toISOString() : null
    });
  }

  auditLog("info", "booking_self_checked_in", {
    bookingId: booking.id,
    bookingCode: booking.bookingCode,
    lineUserId,
    distanceMeters: distanceRounded
  });

  return NextResponse.json({
    message: "เช็คอินสำเร็จ",
    code: "SUCCESS",
    distanceMeters: distanceRounded,
    radiusMeters: settings.checkinRadiusM,
    booking: latest
  });
}
