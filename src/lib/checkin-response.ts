/** ใช้ร่วมกับ self-check-in API และหน้า LIFF */

export type CheckinRemainingParts = {
  days: number;
  hours: number;
  minutes: number;
};

export function remainingUntil(target: Date, from: Date = new Date()): CheckinRemainingParts {
  const ms = Math.max(0, target.getTime() - from.getTime());
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return { days, hours, minutes };
}

/** เช่น "2 วัน 3 ชั่วโมง" หรือ "45 นาที" */
export function formatThaiRemaining(parts: CheckinRemainingParts): string {
  const segs: string[] = [];
  if (parts.days > 0) segs.push(`${parts.days} วัน`);
  if (parts.hours > 0) segs.push(`${parts.hours} ชั่วโมง`);
  if (parts.minutes > 0 || segs.length === 0) segs.push(`${parts.minutes} นาที`);
  return segs.join(" ");
}

export function formatCheckinOpensAtTh(date: Date): string {
  return date.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}
