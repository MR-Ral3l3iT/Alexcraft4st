/** ฉายาตามจำนวนแก้ว (หน้า /liff/energy + milestone Flex) */
export const DRINK_NICKNAME_BELOW_3 = "สายปรับตัว";
export const DRINK_NICKNAME_FROM_3 = "สายอุ่นเครื่อง";
export const DRINK_NICKNAME_FROM_6 = "สายติดลม";
export const DRINK_NICKNAME_FROM_10 = "ตัวตึงแห่งค่ำคืน";

/**
 * เกณฑ์: น้อยกว่า 3 → สายปรับตัว | 3–5 → สายอุ่นเครื่อง | 6–9 → สายติดลม | 10 ขึ้นไป → ตัวตึงแห่งค่ำคืน
 * (สอดคล้อง milestone Flex ที่ 3 / 6 / 10 แก้ว)
 */
export function drinkNicknameForCount(drinkCount: number): string {
  if (drinkCount < 3) return DRINK_NICKNAME_BELOW_3;
  if (drinkCount < 6) return DRINK_NICKNAME_FROM_3;
  if (drinkCount < 10) return DRINK_NICKNAME_FROM_6;
  return DRINK_NICKNAME_FROM_10;
}
