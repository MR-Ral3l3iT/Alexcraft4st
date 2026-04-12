import { describe, expect, it } from "vitest";
import { drinkCooldownRemainingSec } from "../lib/drink-rules";

describe("drinkCooldownRemainingSec", () => {
  it("returns 0 when no last drink", () => {
    expect(drinkCooldownRemainingSec(null, 600, 1_000_000)).toBe(0);
  });

  it("returns 0 when cooldown disabled", () => {
    const last = new Date(1_000_000);
    expect(drinkCooldownRemainingSec(last, 0, 2_000_000)).toBe(0);
  });

  it("returns ceil of remaining seconds", () => {
    const last = new Date(1_000_000);
    expect(drinkCooldownRemainingSec(last, 100, 1_000_000 + 40_100)).toBe(60);
  });

  it("returns 0 when window elapsed", () => {
    const last = new Date(1_000_000);
    expect(drinkCooldownRemainingSec(last, 100, 1_000_000 + 150_000)).toBe(0);
  });
});
