import { describe, expect, it } from "vitest";
import { formatCheckinOpensAtTh, formatThaiRemaining, remainingUntil } from "../lib/checkin-response";

describe("remainingUntil", () => {
  it("splits days hours minutes", () => {
    const from = new Date("2026-04-12T10:00:00.000Z");
    const target = new Date("2026-04-14T13:30:00.000Z");
    expect(remainingUntil(target, from)).toEqual({ days: 2, hours: 3, minutes: 30 });
  });

  it("never returns negative parts", () => {
    const from = new Date("2026-04-14T00:00:00.000Z");
    const target = new Date("2026-04-12T00:00:00.000Z");
    expect(remainingUntil(target, from)).toEqual({ days: 0, hours: 0, minutes: 0 });
  });
});

describe("formatThaiRemaining", () => {
  it("shows minutes only when under an hour", () => {
    expect(formatThaiRemaining({ days: 0, hours: 0, minutes: 45 })).toBe("45 นาที");
  });

  it("combines segments without trailing zero minutes", () => {
    expect(formatThaiRemaining({ days: 1, hours: 2, minutes: 0 })).toBe("1 วัน 2 ชั่วโมง");
  });
});

describe("formatCheckinOpensAtTh", () => {
  it("returns a non-empty Thai locale string", () => {
    const s = formatCheckinOpensAtTh(new Date("2026-05-02T18:00:00+07:00"));
    expect(s.length).toBeGreaterThan(5);
  });
});
