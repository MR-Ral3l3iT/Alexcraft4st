export type BookingStatus =
  | "pending"
  | "waiting_payment_review"
  | "confirmed"
  | "cancelled"
  | "checked_in";

export type BookingPayload = {
  lineUserId: string;
  lineDisplay?: string;
  fullName: string;
  phone: string;
  seats: number;
  note?: string;
  slipUrl?: string;
};
