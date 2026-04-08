import { describe, expect, it } from "vitest";
import { canTransition } from "../lib/booking-rules";

describe("booking status transition", () => {
  it("allows pending -> waiting_payment_review", () => {
    expect(canTransition("pending", "waiting_payment_review")).toBe(true);
  });

  it("allows confirmed -> checked_in", () => {
    expect(canTransition("confirmed", "checked_in")).toBe(true);
  });

  it("blocks checked_in -> confirmed", () => {
    expect(canTransition("checked_in", "confirmed")).toBe(false);
  });

  it("blocks cancelled -> confirmed", () => {
    expect(canTransition("cancelled", "confirmed")).toBe(false);
  });
});
