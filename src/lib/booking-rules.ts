import { BookingStatus } from "@prisma/client";

const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ["waiting_payment_review", "cancelled"],
  waiting_payment_review: ["confirmed", "cancelled"],
  confirmed: ["checked_in", "cancelled"],
  cancelled: [],
  checked_in: []
};

export function canTransition(fromStatus: BookingStatus, toStatus: BookingStatus): boolean {
  return TRANSITIONS[fromStatus].includes(toStatus);
}
