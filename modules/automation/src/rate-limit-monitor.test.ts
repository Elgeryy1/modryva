import { describe, expect, it } from "vitest";
import { detectRateLimitApproach } from "./rate-limit-monitor.js";

describe("detectRateLimitApproach", () => {
  it("returns zero and no flags for an empty timestamp list", () => {
    expect(detectRateLimitApproach([], 1000)).toEqual({
      countInWindow: 0,
      near: false,
      over: false,
    });
  });

  it("counts only timestamps inside the sliding window with defaults", () => {
    const now = 5000;
    const inside = [4100, 4200, 4900, 5000];
    const outside = [3999, 4000, 100];
    expect(detectRateLimitApproach([...inside, ...outside], now)).toEqual({
      countInWindow: 4,
      near: false,
      over: false,
    });
  });

  it("flags near when count reaches limit * warnRatio", () => {
    const timestamps = [10, 20, 30, 40];
    expect(
      detectRateLimitApproach(timestamps, 100, {
        windowMs: 1000,
        limit: 5,
        warnRatio: 0.8,
      }),
    ).toEqual({ countInWindow: 4, near: true, over: false });
  });

  it("flags both near and over when count reaches the limit", () => {
    const timestamps = [10, 20, 30, 40, 50];
    expect(
      detectRateLimitApproach(timestamps, 100, {
        windowMs: 1000,
        limit: 5,
        warnRatio: 0.8,
      }),
    ).toEqual({ countInWindow: 5, near: true, over: true });
  });

  it("excludes a timestamp exactly at the lower bound and includes one at nowMs", () => {
    const now = 1000;
    const opts = { windowMs: 1000, limit: 5, warnRatio: 0.8 };
    expect(detectRateLimitApproach([0], now, opts).countInWindow).toBe(0);
    expect(detectRateLimitApproach([1], now, opts).countInWindow).toBe(1);
    expect(detectRateLimitApproach([1000], now, opts).countInWindow).toBe(1);
  });

  it("ignores future timestamps beyond nowMs", () => {
    expect(
      detectRateLimitApproach([900, 1500, 2000], 1000, {
        windowMs: 1000,
        limit: 5,
      }),
    ).toEqual({ countInWindow: 1, near: false, over: false });
  });

  it("is independent of timestamp order", () => {
    const opts = { windowMs: 1000, limit: 3, warnRatio: 0.66 };
    const ascending = detectRateLimitApproach([100, 200, 300], 1000, opts);
    const shuffled = detectRateLimitApproach([300, 100, 200], 1000, opts);
    expect(shuffled).toEqual(ascending);
    expect(ascending).toEqual({ countInWindow: 3, near: true, over: true });
  });

  it("applies default limit of 30 and warnRatio of 0.8", () => {
    const now = 1000;
    const twentyFour = Array.from({ length: 24 }, (_, i) => now - i);
    expect(detectRateLimitApproach(twentyFour, now)).toEqual({
      countInWindow: 24,
      near: true,
      over: false,
    });
  });

  it("reports over exactly at the default limit boundary", () => {
    const now = 1000;
    const thirty = Array.from({ length: 30 }, (_, i) => now - i);
    expect(detectRateLimitApproach(thirty, now)).toEqual({
      countInWindow: 30,
      near: true,
      over: true,
    });
  });

  it("stays deterministic across repeated calls with identical inputs", () => {
    const timestamps = [10, 20, 30, 40, 50];
    const first = detectRateLimitApproach(timestamps, 100, { limit: 4 });
    const second = detectRateLimitApproach(timestamps, 100, { limit: 4 });
    expect(first).toEqual(second);
    expect(first).toEqual({ countInWindow: 5, near: true, over: true });
  });
});
