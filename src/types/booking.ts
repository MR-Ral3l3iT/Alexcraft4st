export type BookingStatus =
  | "pending"
  | "waiting_payment_review"
  | "confirmed"
  | "cancelled"
  | "checked_in";

export type BookingPayload = {
  lineUserId: string;
  lineDisplay?: string;
  linePictureUrl?: string;
  fullName: string;
  phone: string;
  note?: string;
  slipUrl?: string;
};
