import { broadcastCheckoutDisplay } from "@/lib/checkin-display-broadcast";
import { buildCheckoutCompleteFlexMessage } from "@/lib/line-flex-checkout-complete";
import { safePushFlexMessage } from "@/lib/line";
import { syncRichMenuAfterSelfCheckout } from "@/lib/line-richmenu";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/security/audit";
import { sanitizeText } from "@/lib/security/input";
import { rateLimit } from "@/lib/security/rate-limit";
import { NextRequest, NextResponse } from "next/server";

type SelfCheckoutBody = {
  lineUserId?: string;
};

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const limiter = rateLimit(`booking:self-checkout:${ip}`, 20, 60_000);
  if (!limiter.allowed) {
    return NextResponse.json({ message: "Too many requests" }, { status: 429 });
  }

  const body = (await request.json()) as SelfCheckoutBody;
  const lineUserId = sanitizeText(body.lineUserId, 120);

  if (!lineUserId) {
    return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ LINE ก่อนเช็คเอาท์", code: "LINE_USER_REQUIRED" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { lineUserId } });
  if (!booking) {
    return NextResponse.json({ message: "ไม่พบการจองสำหรับบัญชี LINE นี้", code: "BOOKING_NOT_FOUND" }, { status: 404 });
  }

  if (booking.status !== "checked_in") {
    return NextResponse.json(
      { message: "เช็คเอาท์ได้เฉพาะผู้ที่เช็คอินเข้างานแล้วเท่านั้น", code: "NOT_CHECKED_IN" },
      { status: 400 }
    );
  }

  if (booking.checkedOutAt) {
    return NextResponse.json({
      message: "คุณเช็คเอาท์แล้ว",
      code: "ALREADY_CHECKED_OUT",
      alreadyCheckedOut: true,
      booking
    });
  }

  const now = new Date();
  const updated = await prisma.booking.updateMany({
    where: { id: booking.id, status: "checked_in", checkedOutAt: null },
    data: { checkedOutAt: now }
  });

  if (updated.count === 0) {
    const latest = await prisma.booking.findUnique({ where: { id: booking.id } });
    return NextResponse.json({
      message: "คุณเช็คเอาท์แล้ว",
      code: "ALREADY_CHECKED_OUT",
      alreadyCheckedOut: true,
      booking: latest
    });
  }

  const latest = await prisma.booking.findUnique({ where: { id: booking.id } });
  if (latest) {
    const flex = buildCheckoutCompleteFlexMessage({
      fullName: latest.fullName,
      bookingCode: latest.bookingCode ?? latest.id,
      drinkCount: latest.drinkCount ?? 0,
      checkoutAt: latest.checkedOutAt ?? now
    });
    await safePushFlexMessage(latest.lineUserId, flex);
    await syncRichMenuAfterSelfCheckout(latest.lineUserId);
    broadcastCheckoutDisplay({
      bookingId: latest.id,
      checkedOutAt: (latest.checkedOutAt ?? now).toISOString(),
      drinkCount: latest.drinkCount ?? 0
    });
  }

  auditLog("info", "booking_self_checked_out", {
    bookingId: booking.id,
    bookingCode: booking.bookingCode,
    lineUserId
  });

  return NextResponse.json({
    message: "เช็คเอาท์สำเร็จ",
    code: "SUCCESS",
    booking: latest
  });
}
