import { describe, expect, it } from "vitest";
import {
  type CaseTiming,
  computeCaseMetrics,
  formatCaseDuration,
} from "./case-metrics.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const caseTiming = (overrides: Partial<CaseTiming> = {}): CaseTiming => ({
  createdMs: 0,
  ...overrides,
});

describe("computeCaseMetrics", () => {
  it("returns nulls and zero counts for an empty list", () => {
    expect(computeCaseMetrics([])).toEqual({
      avgFirstResponseMs: null,
      medianFirstResponseMs: null,
      avgResolutionMs: null,
      openCount: 0,
      resolvedCount: 0,
      respondedCount: 0,
    });
  });

  it("averages first response deltas relative to createdMs", () => {
    const cases = [
      caseTiming({
        createdMs: 1_000,
        firstStaffResponseMs: 1_000 + 2 * MINUTE,
      }),
      caseTiming({
        createdMs: 5_000,
        firstStaffResponseMs: 5_000 + 4 * MINUTE,
      }),
    ];
    expect(computeCaseMetrics(cases).avgFirstResponseMs).toBe(3 * MINUTE);
  });

  it("ignores cases without first response in the response average", () => {
    const cases = [
      caseTiming({ firstStaffResponseMs: 10 * MINUTE }),
      caseTiming({}),
      caseTiming({ firstStaffResponseMs: 20 * MINUTE }),
    ];
    const result = computeCaseMetrics(cases);
    expect(result.avgFirstResponseMs).toBe(15 * MINUTE);
    expect(result.respondedCount).toBe(2);
  });

  it("ignores cases without resolvedMs in the resolution average", () => {
    const cases = [
      caseTiming({ resolvedMs: 2 * HOUR }),
      caseTiming({}),
      caseTiming({ resolvedMs: 4 * HOUR }),
    ];
    const result = computeCaseMetrics(cases);
    expect(result.avgResolutionMs).toBe(3 * HOUR);
    expect(result.resolvedCount).toBe(2);
  });

  it("counts open cases as those without resolvedMs", () => {
    const cases = [
      caseTiming({ resolvedMs: HOUR }),
      caseTiming({}),
      caseTiming({ firstStaffResponseMs: MINUTE }),
      caseTiming({ resolvedMs: 2 * HOUR }),
    ];
    const result = computeCaseMetrics(cases);
    expect(result.openCount).toBe(2);
    expect(result.resolvedCount).toBe(2);
  });

  it("computes the median of an odd number of response deltas", () => {
    const cases = [
      caseTiming({ firstStaffResponseMs: 5 * MINUTE }),
      caseTiming({ firstStaffResponseMs: 1 * MINUTE }),
      caseTiming({ firstStaffResponseMs: 3 * MINUTE }),
    ];
    expect(computeCaseMetrics(cases).medianFirstResponseMs).toBe(3 * MINUTE);
  });

  it("computes the median of an even number as the average of the two middle values", () => {
    const cases = [
      caseTiming({ firstStaffResponseMs: 2 * MINUTE }),
      caseTiming({ firstStaffResponseMs: 8 * MINUTE }),
      caseTiming({ firstStaffResponseMs: 4 * MINUTE }),
      caseTiming({ firstStaffResponseMs: 6 * MINUTE }),
    ];
    expect(computeCaseMetrics(cases).medianFirstResponseMs).toBe(5 * MINUTE);
  });

  it("does not mutate the input order when computing the median", () => {
    const cases = [
      caseTiming({ firstStaffResponseMs: 9 * MINUTE }),
      caseTiming({ firstStaffResponseMs: 1 * MINUTE }),
      caseTiming({ firstStaffResponseMs: 5 * MINUTE }),
    ];
    const snapshot = cases.map((c) => c.firstStaffResponseMs);
    computeCaseMetrics(cases);
    expect(cases.map((c) => c.firstStaffResponseMs)).toEqual(snapshot);
  });

  it("handles a fully open list with no responses", () => {
    const cases = [caseTiming({}), caseTiming({})];
    expect(computeCaseMetrics(cases)).toEqual({
      avgFirstResponseMs: null,
      medianFirstResponseMs: null,
      avgResolutionMs: null,
      openCount: 2,
      resolvedCount: 0,
      respondedCount: 0,
    });
  });

  it("is deterministic across repeated calls with the same input", () => {
    const cases = [
      caseTiming({
        createdMs: 100,
        firstStaffResponseMs: 100 + 7 * MINUTE,
        resolvedMs: 100 + HOUR,
      }),
      caseTiming({ createdMs: 200, firstStaffResponseMs: 200 + 3 * MINUTE }),
    ];
    expect(computeCaseMetrics(cases)).toEqual(computeCaseMetrics(cases));
  });

  it("supports a case that is responded and resolved at once", () => {
    const cases = [
      caseTiming({
        createdMs: 0,
        firstStaffResponseMs: 10 * MINUTE,
        resolvedMs: 30 * MINUTE,
      }),
    ];
    expect(computeCaseMetrics(cases)).toEqual({
      avgFirstResponseMs: 10 * MINUTE,
      medianFirstResponseMs: 10 * MINUTE,
      avgResolutionMs: 30 * MINUTE,
      openCount: 0,
      resolvedCount: 1,
      respondedCount: 1,
    });
  });
});

describe("formatCaseDuration", () => {
  it("returns <1m for less than a minute and for negatives", () => {
    expect(formatCaseDuration(0)).toBe("<1m");
    expect(formatCaseDuration(59_999)).toBe("<1m");
    expect(formatCaseDuration(-5 * MINUTE)).toBe("<1m");
  });

  it("formats whole minutes under an hour", () => {
    expect(formatCaseDuration(MINUTE)).toBe("1m");
    expect(formatCaseDuration(59 * MINUTE + 59_000)).toBe("59m");
  });

  it("formats hours with remaining minutes", () => {
    expect(formatCaseDuration(2 * HOUR + 3 * MINUTE)).toBe("2h 3m");
  });

  it("omits the minute part on exact hours", () => {
    expect(formatCaseDuration(2 * HOUR)).toBe("2h");
  });

  it("formats days with remaining hours", () => {
    expect(formatCaseDuration(DAY + 4 * HOUR)).toBe("1d 4h");
  });

  it("omits the hour part on exact days", () => {
    expect(formatCaseDuration(2 * DAY)).toBe("2d");
  });
});
