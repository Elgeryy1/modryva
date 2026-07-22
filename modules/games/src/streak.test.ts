import { describe, expect, it } from "vitest";
import { computeStreak } from "./streak.js";

describe("computeStreak", () => {
  const TODAY = 20_275;

  it("counts consecutive days ending today", () => {
    expect(computeStreak([TODAY, TODAY - 1, TODAY - 2], TODAY)).toBe(3);
  });

  it("stays alive when the last play was yesterday (not yet today)", () => {
    expect(computeStreak([TODAY - 1, TODAY - 2], TODAY)).toBe(2);
  });

  it("breaks when the last play is older than yesterday", () => {
    expect(computeStreak([TODAY - 2, TODAY - 3], TODAY)).toBe(0);
  });

  it("counts only the unbroken run from the anchor", () => {
    // today + a gap at day-1 → only today counts.
    expect(computeStreak([TODAY, TODAY - 2, TODAY - 3], TODAY)).toBe(1);
  });

  it("is order-independent and ignores duplicates", () => {
    expect(computeStreak([TODAY - 2, TODAY, TODAY, TODAY - 1], TODAY)).toBe(3);
  });

  it("returns 0 for no plays", () => {
    expect(computeStreak([], TODAY)).toBe(0);
  });

  it("ignores non-finite day keys", () => {
    expect(computeStreak([TODAY, Number.NaN, TODAY - 1], TODAY)).toBe(2);
  });
});
