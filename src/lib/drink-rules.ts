/** วินาทีที่เหลือจนกว่าจะกดเติมแก้วครั้งถัดไปได้ (0 = พร้อม) */
export function drinkCooldownRemainingSec(
  drinkLastAt: Date | null,
  drinkCooldownSec: number,
  nowMs: number = Date.now()
): number {
  if (drinkCooldownSec <= 0 || !drinkLastAt) return 0;
  const elapsedSec = (nowMs - drinkLastAt.getTime()) / 1000;
  return Math.max(0, Math.ceil(drinkCooldownSec - elapsedSec));
}
