import { safePushTextMessage } from "@/lib/line";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/security/audit";
import { rateLimit } from "@/lib/security/rate-limit";
import { sanitizeText } from "@/lib/security/input";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

function buildRemindSlipMessage(fullName: string, bookingCode: string | null): string {
  const greeting = fullName.trim() ? `เรียน ${fullName.trim()}` : "สวัสดีครับ/ค่ะ";
  const codeLine = bookingCode ? `\nรหัสจอง: ${bookingCode}` : "";
  return `${greeting}\nกรุณาแนบสลิปการโอนเงินเพื่อทำให้สถานะการลงทะเบียนจองเข้างานเสร็จสมบูรณ์${codeLine}\nแนบสลิปได้จากเมนูตรวจสอบสถานะการจองใน LINE ขอบคุณครับ/ค่ะ`;
}

export async function POST(req: NextRequest, context: RouteContext) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  const ipLimiter = rateLimit(`booking:remind-slip:ip:${ip}`, 40, 60_000);
  if (!ipLimiter.allowed) {
    return NextResponse.json({ message: "Too many requests" }, { status: 429 });
  }

  const { id: rawId } = await context.params;
  const id = sanitizeText(rawId, 120);
  const bookingLimiter = rateLimit(`booking:remind-slip:booking:${id}`, 5, 60 * 60_000);
  if (!bookingLimiter.allowed) {
    return NextResponse.json(
      { message: "ส่งแจ้งเตือนรายการนี้บ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" },
      { status: 429 }
    );
  }

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    return NextResponse.json({ message: "Booking not found" }, { status: 404 });
  }

  if (booking.status !== "pending") {
    return NextResponse.json(
      { message: "ส่งได้เฉพาะรายการที่ยังรอชำระเงินและยังไม่มีสลิป (สถานะรอข้อมูลเพิ่มเติม)" },
      { status: 400 }
    );
  }

  if (booking.slipUrl) {
    return NextResponse.json({ message: "รายการนี้มีสลิปในระบบแล้ว" }, { status: 400 });
  }

  const text = buildRemindSlipMessage(booking.fullName, booking.bookingCode);
  const push = await safePushTextMessage(booking.lineUserId, text);

  if (push.skipped) {
    return NextResponse.json({ message: "ระบบยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN" }, { status: 503 });
  }

  if (!push.ok) {
    return NextResponse.json(
      { message: push.reason ?? "ส่งข้อความ LINE ไม่สำเร็จ" },
      { status: 502 }
    );
  }

  auditLog("info", "booking_remind_slip_sent", {
    bookingId: id,
    bookingCode: booking.bookingCode,
    lineUserId: booking.lineUserId
  });

  return NextResponse.json({ ok: true });
}
