import { describe, expect, it } from "vitest";
import {
  computeSeparationUntilMs,
  isSeparationActive,
  separationRemainingMs,
} from "./user-separation.js";

const MS_PER_HOUR = 3_600_000;
const TWELVE_HOURS = 12 * MS_PER_HOUR;

describe("computeSeparationUntilMs", () => {
  it("uses the default 12 hour window", () => {
    expect(computeSeparationUntilMs(1000)).toBe(1000 + TWELVE_HOURS);
  });
  it("honours a custom hours option", () => {
    expect(computeSeparationUntilMs(0, { hours: 1 })).toBe(MS_PER_HOUR);
  });
  it("treats zero hours as no window", () => {
    expect(computeSeparationUntilMs(5000, { hours: 0 })).toBe(5000);
  });
  it("clamps a negative duration to no window", () => {
    expect(computeSeparationUntilMs(5000, { hours: -3 })).toBe(5000);
  });
});

describe("isSeparationActive", () => {
  it("is active one millisecond before the window ends", () => {
    expect(isSeparationActive(0, TWELVE_HOURS - 1)).toBe(true);
  });
  it("is not active at the exact boundary instant", () => {
    expect(isSeparationActive(0, TWELVE_HOURS)).toBe(false);
  });
  it("is active well inside a custom window", () => {
    expect(isSeparationActive(0, 100, { hours: 1 })).toBe(true);
  });
  it("is not active after a custom window has passed", () => {
    expect(isSeparationActive(0, 5_000_000, { hours: 1 })).toBe(false);
  });
});

describe("separationRemainingMs", () => {
  it("reports the exact remaining milliseconds", () => {
    expect(separationRemainingMs(0, TWELVE_HOURS - 1000)).toBe(1000);
  });
  it("clamps to zero once the window has ended", () => {
    expect(separationRemainingMs(0, TWELVE_HOURS + 999)).toBe(0);
  });
  it("is deterministic across repeated calls", () => {
    const first = separationRemainingMs(2500, 1000, { hours: 2 });
    const second = separationRemainingMs(2500, 1000, { hours: 2 });
    expect(first).toBe(second);
    expect(first).toBe(2500 + 2 * MS_PER_HOUR - 1000);
  });
});
