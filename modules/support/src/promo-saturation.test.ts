import { describe, expect, it } from "vitest";
import { checkPromoSaturation } from "./promo-saturation.js";

describe("checkPromoSaturation", () => {
  it("reports no saturation for an empty history", () => {
    expect(checkPromoSaturation([], 1_000_000)).toEqual({
      saturated: false,
      countInWindow: 0,
    });
  });

  it("saturates once the default maximum of two promos is reached", () => {
    expect(checkPromoSaturation([990_000, 995_000], 1_000_000)).toEqual({
      saturated: true,
      countInWindow: 2,
    });
  });

  it("stays below the default maximum with a single recent promo", () => {
    expect(checkPromoSaturation([995_000], 1_000_000)).toEqual({
      saturated: false,
      countInWindow: 1,
    });
  });

  it("ignores expired timestamps outside the window", () => {
    expect(
      checkPromoSaturation([10, 50, 99_500, 100_000], 100_000, {
        windowMs: 1_000,
      }),
    ).toEqual({ saturated: true, countInWindow: 2 });
  });

  it("excludes a timestamp exactly windowMs old but includes one at nowMs", () => {
    expect(
      checkPromoSaturation([0, 1_000], 1_000, { windowMs: 1_000 }),
    ).toEqual({ saturated: false, countInWindow: 1 });
  });

  it("ignores future timestamps beyond nowMs", () => {
    expect(
      checkPromoSaturation([1_500, 2_000], 1_000, { windowMs: 1_000 }),
    ).toEqual({ saturated: false, countInWindow: 0 });
  });

  it("respects custom windowMs and maxInWindow options", () => {
    expect(
      checkPromoSaturation([1_000, 5_000, 9_000], 10_000, {
        windowMs: 6_000,
        maxInWindow: 3,
      }),
    ).toEqual({ saturated: false, countInWindow: 2 });
  });

  it("treats a maximum of zero as always saturated", () => {
    expect(checkPromoSaturation([], 1_000, { maxInWindow: 0 })).toEqual({
      saturated: true,
      countInWindow: 0,
    });
  });

  it("falls back to the default maximum when only windowMs is provided", () => {
    expect(
      checkPromoSaturation([9_000, 9_500, 9_800], 10_000, { windowMs: 2_000 }),
    ).toEqual({ saturated: true, countInWindow: 3 });
  });

  it("is order-independent for the same set of timestamps", () => {
    const now = 100_000;
    const first = checkPromoSaturation([99_500, 100_000, 10], now, {
      windowMs: 1_000,
    });
    const second = checkPromoSaturation([10, 100_000, 99_500], now, {
      windowMs: 1_000,
    });
    expect(first).toEqual(second);
    expect(first).toEqual({ saturated: true, countInWindow: 2 });
  });
});
