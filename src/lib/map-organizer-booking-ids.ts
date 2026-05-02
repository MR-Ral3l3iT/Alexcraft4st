/**
 * ระบุผู้จัดงานบนแผนที่ — ใช้ตัวละคร character_03
 * ตั้งใน `.env`: NEXT_PUBLIC_DISPLAY_MAP_ORGANIZER_BOOKING_IDS="clxxx...,cm..."
 */
export function parseOrganizerBookingIds(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

export function isOrganizerBookingId(bookingId: string): boolean {
  const ids = parseOrganizerBookingIds(process.env.NEXT_PUBLIC_DISPLAY_MAP_ORGANIZER_BOOKING_IDS);
  return ids.has(bookingId);
}
