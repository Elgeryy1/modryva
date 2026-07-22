import { describe, expect, it } from "vitest";
import { computeBossProgress } from "./boss-progress.js";

describe("computeBossProgress", () => {
  it("computes half progress for a partially completed boss", () => {
    expect(computeBossProgress({ done: 5, goal: 10 })).toEqual({
      percent: 50,
      defeated: false,
      remaining: 5,
    });
  });

  it("marks the boss defeated when the goal is exactly met", () => {
    expect(computeBossProgress({ done: 10, goal: 10 })).toEqual({
      percent: 100,
      defeated: true,
      remaining: 0,
    });
  });

  it("clamps percent to 100 and remaining to 0 when overshooting", () => {
    expect(computeBossProgress({ done: 15, goal: 10 })).toEqual({
      percent: 100,
      defeated: true,
      remaining: 0,
    });
  });

  it("reports zero progress at the start", () => {
    expect(computeBossProgress({ done: 0, goal: 10 })).toEqual({
      percent: 0,
      defeated: false,
      remaining: 10,
    });
  });

  it("guards a zero goal and treats it as already defeated", () => {
    expect(computeBossProgress({ done: 0, goal: 0 })).toEqual({
      percent: 0,
      defeated: true,
      remaining: 0,
    });
  });

  it("guards a negative goal without producing negative remaining", () => {
    expect(computeBossProgress({ done: 5, goal: -3 })).toEqual({
      percent: 0,
      defeated: true,
      remaining: 0,
    });
  });

  it("rounds fractional ratios to the nearest integer (down)", () => {
    expect(computeBossProgress({ done: 1, goal: 3 })).toEqual({
      percent: 33,
      defeated: false,
      remaining: 2,
    });
  });

  it("rounds fractional ratios to the nearest integer (up)", () => {
    expect(computeBossProgress({ done: 2, goal: 3 })).toEqual({
      percent: 67,
      defeated: false,
      remaining: 1,
    });
  });

  it("clamps percent to 0 for negative done and keeps remaining accurate", () => {
    expect(computeBossProgress({ done: -5, goal: 10 })).toEqual({
      percent: 0,
      defeated: false,
      remaining: 15,
    });
  });

  it("is deterministic across repeated calls with the same input", () => {
    const first = computeBossProgress({ done: 7, goal: 20 });
    const second = computeBossProgress({ done: 7, goal: 20 });
    expect(first).toEqual(second);
    expect(first).toEqual({ percent: 35, defeated: false, remaining: 13 });
  });
});
