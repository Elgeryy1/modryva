import { describe, expect, it } from "vitest";
import {
  isUnreliableReporter,
  type Reporter,
  rankReporters,
  reporterAccuracy,
} from "./report-quality.js";

const reporter = (overrides: Partial<Reporter> = {}): Reporter => ({
  userId: "u1",
  valid: 0,
  invalid: 0,
  ...overrides,
});

describe("reporterAccuracy", () => {
  it("returns valid / (valid + invalid)", () => {
    expect(reporterAccuracy(reporter({ valid: 3, invalid: 1 }))).toBe(0.75);
  });

  it("returns 1 when every report was valid", () => {
    expect(reporterAccuracy(reporter({ valid: 5, invalid: 0 }))).toBe(1);
  });

  it("returns 0 when every report was invalid", () => {
    expect(reporterAccuracy(reporter({ valid: 0, invalid: 4 }))).toBe(0);
  });

  it("returns 0 for a reporter with no reports (no division by zero)", () => {
    expect(reporterAccuracy(reporter({ valid: 0, invalid: 0 }))).toBe(0);
  });

  it("clamps negative tallies to 0", () => {
    expect(reporterAccuracy(reporter({ valid: -2, invalid: -3 }))).toBe(0);
    expect(reporterAccuracy(reporter({ valid: -1, invalid: 4 }))).toBe(0);
    expect(reporterAccuracy(reporter({ valid: 3, invalid: -5 }))).toBe(1);
  });

  it("stays within 0..1 for large tallies", () => {
    const acc = reporterAccuracy(reporter({ valid: 999, invalid: 1 }));
    expect(acc).toBeGreaterThan(0);
    expect(acc).toBeLessThanOrEqual(1);
    expect(acc).toBeCloseTo(0.999, 5);
  });

  it("is deterministic for identical inputs", () => {
    const r = reporter({ valid: 7, invalid: 3 });
    expect(reporterAccuracy(r)).toBe(reporterAccuracy(r));
  });
});

describe("rankReporters", () => {
  it("orders reporters by descending accuracy", () => {
    const result = rankReporters([
      reporter({ userId: "low", valid: 1, invalid: 3 }),
      reporter({ userId: "high", valid: 9, invalid: 1 }),
      reporter({ userId: "mid", valid: 1, invalid: 1 }),
    ]);
    expect(result.map((r) => r.userId)).toEqual(["high", "mid", "low"]);
  });

  it("pairs each userId with its accuracy", () => {
    expect(
      rankReporters([reporter({ userId: "u", valid: 3, invalid: 1 })]),
    ).toEqual([{ userId: "u", accuracy: 0.75 }]);
  });

  it("keeps input order for ties (stable)", () => {
    const result = rankReporters([
      reporter({ userId: "a", valid: 1, invalid: 1 }),
      reporter({ userId: "b", valid: 5, invalid: 5 }),
      reporter({ userId: "c", valid: 2, invalid: 2 }),
    ]);
    expect(result.map((r) => r.userId)).toEqual(["a", "b", "c"]);
    expect(result.every((r) => r.accuracy === 0.5)).toBe(true);
  });

  it("places no-report reporters (accuracy 0) last", () => {
    const result = rankReporters([
      reporter({ userId: "empty", valid: 0, invalid: 0 }),
      reporter({ userId: "good", valid: 4, invalid: 0 }),
    ]);
    expect(result.map((r) => r.userId)).toEqual(["good", "empty"]);
  });

  it("returns an empty array for an empty input", () => {
    expect(rankReporters([])).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input: readonly Reporter[] = [
      reporter({ userId: "a", valid: 1, invalid: 9 }),
      reporter({ userId: "b", valid: 9, invalid: 1 }),
    ];
    const snapshot = input.map((r) => r.userId);
    rankReporters(input);
    expect(input.map((r) => r.userId)).toEqual(snapshot);
  });
});

describe("isUnreliableReporter", () => {
  it("is true when accuracy is below the threshold", () => {
    expect(isUnreliableReporter(reporter({ valid: 1, invalid: 9 }), 0.5)).toBe(
      true,
    );
  });

  it("is false when accuracy meets or exceeds the threshold", () => {
    expect(isUnreliableReporter(reporter({ valid: 9, invalid: 1 }), 0.5)).toBe(
      false,
    );
  });

  it("uses a strict comparison at the threshold boundary", () => {
    // accuracy exactly 0.5 is not below 0.5
    expect(isUnreliableReporter(reporter({ valid: 1, invalid: 1 }), 0.5)).toBe(
      false,
    );
  });

  it("treats a no-report reporter as unreliable for any positive threshold", () => {
    expect(isUnreliableReporter(reporter({ valid: 0, invalid: 0 }), 0.1)).toBe(
      true,
    );
  });

  it("treats everyone as reliable when threshold is 0", () => {
    expect(isUnreliableReporter(reporter({ valid: 0, invalid: 0 }), 0)).toBe(
      false,
    );
    expect(isUnreliableReporter(reporter({ valid: 0, invalid: 5 }), 0)).toBe(
      false,
    );
  });
});
