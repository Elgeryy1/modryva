import { describe, expect, it } from "vitest";
import {
  computeGraceDeadlineMs,
  DEFAULT_GRACE_MS,
  graceRemainingMs,
  isWithinGrace,
} from "./grace-window.js";

describe("computeGraceDeadlineMs", () => {
  it("adds the default grace window to sentMs", () => {
    expect(computeGraceDeadlineMs(1000)).toBe(1000 + DEFAULT_GRACE_MS);
  });
  it("honors a custom graceMs", () => {
    expect(computeGraceDeadlineMs(1000, { graceMs: 5000 })).toBe(6000);
  });
  it("falls back to default for a negative graceMs", () => {
    expect(computeGraceDeadlineMs(1000, { graceMs: -5 })).toBe(31000);
  });
  it("falls back to default for a non-finite graceMs", () => {
    expect(computeGraceDeadlineMs(0, { graceMs: Number.NaN })).toBe(
      DEFAULT_GRACE_MS,
    );
  });
});

describe("isWithinGrace", () => {
  it("is true well inside the window", () => {
    expect(isWithinGrace(1000, 5000)).toBe(true);
  });
  it("is false exactly at the deadline (exclusive boundary)", () => {
    expect(isWithinGrace(1000, 31000)).toBe(false);
  });
  it("is true one millisecond before the deadline", () => {
    expect(isWithinGrace(1000, 30999)).toBe(true);
  });
  it("treats clock skew (now before sent) as within grace", () => {
    expect(isWithinGrace(1000, 500)).toBe(true);
  });
  it("respects a custom graceMs boundary", () => {
    expect(isWithinGrace(1000, 6000, { graceMs: 5000 })).toBe(false);
  });
});

describe("graceRemainingMs", () => {
  it("returns the remaining time inside the window", () => {
    expect(graceRemainingMs(1000, 5000)).toBe(26000);
  });
  it("clamps to zero at the deadline", () => {
    expect(graceRemainingMs(1000, 31000)).toBe(0);
  });
  it("clamps to zero once the window has passed", () => {
    expect(graceRemainingMs(1000, 40000)).toBe(0);
  });
  it("is deterministic across repeated calls with identical inputs", () => {
    const first = graceRemainingMs(2000, 9000, { graceMs: 10000 });
    const second = graceRemainingMs(2000, 9000, { graceMs: 10000 });
    expect(first).toBe(3000);
    expect(second).toBe(3000);
  });
});
