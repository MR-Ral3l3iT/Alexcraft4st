import { auditLog } from "@/lib/security/audit";
import type { Server as SocketIoServer } from "socket.io";

/** Payload สำหรับหน้าจอ TV — ไม่ส่ง lineUserId */
export type CheckinDisplayPayload = {
  fullName: string;
  pictureUrl: string | null;
  checkedInAt: string;
  source: "self" | "admin";
  /** ลำดับผู้เข้างานตามเวลาเช็คอิน (1 = คนแรกของงาน) */
  guestNumber: number;
  /** จำนวนแก้ว ณ เวลาเช็คอิน — ใช้คำนวณฉายาบนหน้าจอ TV */
  drinkCount: number;
  bookingId: string;
  /** ยังอยู่ในงาน = null | เช็คเอาท์แล้ว = ISO time */
  checkedOutAt: string | null;
};

/** อัปเดตหน้าจอ TV หลัง self-checkout */
export type CheckinDisplayCheckoutPayload = {
  bookingId: string;
  checkedOutAt: string;
  drinkCount: number;
};

const EVENT_NAME = "check-in";
const EVENT_CHECKOUT = "check-out";
export const CHECKIN_DISPLAY_ROOM = "checkin-display";

function getSocketIOServer(): SocketIoServer | null {
  return globalThis.__SOCKET_IO__ ?? null;
}

/**
 * แจ้งหน้าจอ TV หลังเช็คอินสำเร็จ (ไม่ throw — ล้มเหลวแค่ log)
 * ทำงานเมื่อรันแอปผ่าน `server.mjs` เท่านั้น (มี global __SOCKET_IO__)
 */
export function broadcastCheckInDisplay(payload: CheckinDisplayPayload): void {
  const io = getSocketIOServer();
  if (!io) {
    return;
  }
  try {
    io.to(CHECKIN_DISPLAY_ROOM).emit(EVENT_NAME, payload);
  } catch (err) {
    auditLog("warn", "checkin_display_broadcast_failed", {
      room: CHECKIN_DISPLAY_ROOM,
      message: err instanceof Error ? err.message : String(err)
    });
  }
}

export function broadcastCheckoutDisplay(payload: CheckinDisplayCheckoutPayload): void {
  const io = getSocketIOServer();
  if (!io) {
    return;
  }
  try {
    io.to(CHECKIN_DISPLAY_ROOM).emit(EVENT_CHECKOUT, payload);
  } catch (err) {
    auditLog("warn", "checkin_display_checkout_broadcast_failed", {
      room: CHECKIN_DISPLAY_ROOM,
      message: err instanceof Error ? err.message : String(err)
    });
  }
}
