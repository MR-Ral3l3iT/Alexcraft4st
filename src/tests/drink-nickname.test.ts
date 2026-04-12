import { describe, expect, it } from "vitest";
import {
  DRINK_NICKNAME_BELOW_3,
  DRINK_NICKNAME_FROM_10,
  DRINK_NICKNAME_FROM_3,
  DRINK_NICKNAME_FROM_6,
  drinkNicknameForCount
} from "../lib/drink-nickname";

describe("drinkNicknameForCount", () => {
  it("below 3 glasses", () => {
    expect(drinkNicknameForCount(0)).toBe(DRINK_NICKNAME_BELOW_3);
    expect(drinkNicknameForCount(2)).toBe(DRINK_NICKNAME_BELOW_3);
  });

  it("3–5 glasses", () => {
    expect(drinkNicknameForCount(3)).toBe(DRINK_NICKNAME_FROM_3);
    expect(drinkNicknameForCount(5)).toBe(DRINK_NICKNAME_FROM_3);
  });

  it("6–9 glasses", () => {
    expect(drinkNicknameForCount(6)).toBe(DRINK_NICKNAME_FROM_6);
    expect(drinkNicknameForCount(9)).toBe(DRINK_NICKNAME_FROM_6);
  });

  it("10+ glasses", () => {
    expect(drinkNicknameForCount(10)).toBe(DRINK_NICKNAME_FROM_10);
    expect(drinkNicknameForCount(99)).toBe(DRINK_NICKNAME_FROM_10);
  });
});
