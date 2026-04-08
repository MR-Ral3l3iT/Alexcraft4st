import { BookingStatus } from "@/types/booking";

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "รอข้อมูลเพิ่มเติม",
  waiting_payment_review: "รอตรวจสอบชำระเงิน",
  confirmed: "ยืนยันแล้ว",
  cancelled: "ยกเลิก",
  checked_in: "เช็คอินแล้ว"
};

export function bookingStatusLabel(status: BookingStatus): string {
  return STATUS_LABEL[status] ?? status;
}

export function generateBookingCode(): string {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `BK-${random}`;
}
