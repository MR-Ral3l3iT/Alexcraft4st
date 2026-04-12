import { describe, expect, it } from "vitest";
import { drinkMilestoneLevelForCount } from "../lib/line-flex-drink-milestone";

describe("drinkMilestoneLevelForCount", () => {
  it("returns null below first milestone", () => {
    expect(drinkMilestoneLevelForCount(0)).toBeNull();
    expect(drinkMilestoneLevelForCount(2)).toBeNull();
  });

  it("returns level 1 at 3 glasses", () => {
    expect(drinkMilestoneLevelForCount(3)).toBe(1);
  });

  it("returns level 2 at 6 glasses", () => {
    expect(drinkMilestoneLevelForCount(6)).toBe(2);
  });

  it("returns level 3 at 10 glasses", () => {
    expect(drinkMilestoneLevelForCount(10)).toBe(3);
  });

  it("returns null between milestones", () => {
    expect(drinkMilestoneLevelForCount(4)).toBeNull();
    expect(drinkMilestoneLevelForCount(7)).toBeNull();
    expect(drinkMilestoneLevelForCount(11)).toBeNull();
  });
});
