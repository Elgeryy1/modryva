import { describe, expect, it } from "vitest";
import { computeBackoffMs, shouldRetry } from "./retry-backoff.js";

const BASE = 100;
const MAX = 30_000;

describe("computeBackoffMs", () => {
  it("is deterministic: identical inputs give identical output", () => {
    expect(computeBackoffMs(3, BASE, MAX)).toBe(computeBackoffMs(3, BASE, MAX));
    expect(computeBackoffMs(0, BASE, MAX)).toBe(computeBackoffMs(0, BASE, MAX));
  });

  it("stays within [capped/2, capped] for attempt 0", () => {
    const value = computeBackoffMs(0, BASE, MAX);
    expect(value).toBeGreaterThanOrEqual(BASE / 2);
    expect(value).toBeLessThanOrEqual(BASE);
  });

  it("keeps the equal-jitter bounds for several attempts", () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const capped = Math.min(BASE * 2 ** attempt, MAX);
      const value = computeBackoffMs(attempt, BASE, MAX);
      expect(value).toBeGreaterThanOrEqual(Math.floor(capped / 2) - 1);
      expect(value).toBeLessThanOrEqual(capped);
    }
  });

  it("never exceeds maxMs even for very large attempts", () => {
    expect(computeBackoffMs(40, BASE, MAX)).toBeLessThanOrEqual(MAX);
    expect(computeBackoffMs(1000, BASE, MAX)).toBeLessThanOrEqual(MAX);
  });

  it("is always non-negative", () => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      expect(computeBackoffMs(attempt, BASE, MAX)).toBeGreaterThanOrEqual(0);
    }
  });

  it("grows (non-strictly) with the attempt until the cap", () => {
    const a0 = computeBackoffMs(0, BASE, MAX);
    const a2 = computeBackoffMs(2, BASE, MAX);
    const a5 = computeBackoffMs(5, BASE, MAX);
    expect(a2).toBeGreaterThanOrEqual(a0);
    expect(a5).toBeGreaterThanOrEqual(a2);
  });

  it("caps at maxMs/2 as a floor once fully saturated", () => {
    const value = computeBackoffMs(50, BASE, MAX);
    expect(value).toBeGreaterThanOrEqual(MAX / 2 - 1);
    expect(value).toBeLessThanOrEqual(MAX);
  });

  it("treats negative attempts as attempt 0", () => {
    expect(computeBackoffMs(-5, BASE, MAX)).toBe(
      computeBackoffMs(0, BASE, MAX),
    );
  });

  it("floors fractional attempts", () => {
    expect(computeBackoffMs(3.9, BASE, MAX)).toBe(
      computeBackoffMs(3, BASE, MAX),
    );
  });

  it("returns 0 when baseMs is non-positive", () => {
    expect(computeBackoffMs(3, 0, MAX)).toBe(0);
    expect(computeBackoffMs(3, -100, MAX)).toBe(0);
  });

  it("returns 0 when maxMs is non-positive", () => {
    expect(computeBackoffMs(3, BASE, 0)).toBe(0);
    expect(computeBackoffMs(3, BASE, -1)).toBe(0);
  });

  it("returns 0 for non-finite base or max", () => {
    expect(computeBackoffMs(3, Number.NaN, MAX)).toBe(0);
    expect(computeBackoffMs(3, BASE, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("treats non-finite attempt as attempt 0", () => {
    expect(computeBackoffMs(Number.NaN, BASE, MAX)).toBe(
      computeBackoffMs(0, BASE, MAX),
    );
  });

  it("returns an integer number of milliseconds", () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const value = computeBackoffMs(attempt, 137, MAX);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it("varies the jitter across attempts (not a constant fraction)", () => {
    const fractions = new Set<number>();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const capped = Math.min(BASE * 2 ** attempt, MAX);
      fractions.add(computeBackoffMs(attempt, BASE, MAX) / capped);
    }
    expect(fractions.size).toBeGreaterThan(1);
  });

  it("respects a tiny maxMs below the base value", () => {
    const value = computeBackoffMs(4, BASE, 50);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(50);
  });
});

describe("shouldRetry", () => {
  it("returns true while attempt is below maxAttempts", () => {
    expect(shouldRetry(0, 3)).toBe(true);
    expect(shouldRetry(1, 3)).toBe(true);
    expect(shouldRetry(2, 3)).toBe(true);
  });

  it("returns false when attempts are exhausted", () => {
    expect(shouldRetry(3, 3)).toBe(false);
    expect(shouldRetry(4, 3)).toBe(false);
  });

  it("returns false for non-positive maxAttempts", () => {
    expect(shouldRetry(0, 0)).toBe(false);
    expect(shouldRetry(0, -1)).toBe(false);
  });

  it("returns false for negative attempt", () => {
    expect(shouldRetry(-1, 3)).toBe(false);
  });

  it("returns false for non-finite inputs", () => {
    expect(shouldRetry(Number.NaN, 3)).toBe(false);
    expect(shouldRetry(1, Number.POSITIVE_INFINITY)).toBe(false);
    expect(shouldRetry(Number.POSITIVE_INFINITY, 3)).toBe(false);
  });

  it("is deterministic for identical inputs", () => {
    expect(shouldRetry(2, 5)).toBe(shouldRetry(2, 5));
  });
});
