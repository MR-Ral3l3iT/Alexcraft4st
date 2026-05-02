/**
 * ระบุผู้จัดงานบนแผนที่ — ใช้ตัวละคร character_03
 * ตั้งใน `.env`: NEXT_PUBLIC_DISPLAY_MAP_ORGANIZER_BOOKING_IDS
 * คั่นด้วยจุลภาค — ใส่ได้ทั้ง internal `Booking.id` (จาก URL /admin/bookings/...) หรือรหัสจอง `BK-...`
 */
function normToken(s: string): string {
  return s.trim().toUpperCase();
}

export function parseOrganizerBookingIds(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => normToken(s))
      .filter(Boolean)
  );
}

export function isOrganizerBookingId(bookingId: string, bookingCode?: string | null): boolean {
  const keys = parseOrganizerBookingIds(process.env.NEXT_PUBLIC_DISPLAY_MAP_ORGANIZER_BOOKING_IDS);
  if (keys.has(normToken(bookingId))) return true;
  if (bookingCode?.trim()) {
    if (keys.has(normToken(bookingCode))) return true;
  }
  return false;
}
