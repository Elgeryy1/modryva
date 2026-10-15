import { describe, expect, it } from "vitest";
import { computeResolutionStats } from "./resolution-time.js";

describe("computeResolutionStats", () => {
  it("computes counts, median and p90 for a set of resolved cases", () => {
    const stats = computeResolutionStats([
      { openedMs: 0, resolvedMs: 10 },
      { openedMs: 100, resolvedMs: 120 },
      { openedMs: 0, resolvedMs: 30 },
      { openedMs: 1000, resolvedMs: 1040 },
    ]);
    expect(stats).toEqual({
      resolvedCount: 4,
      openCount: 0,
      medianMs: 25,
      p90Ms: 40,
    });
  });

  it("mixes open, valid and inconsistent cases", () => {
    const stats = computeResolutionStats([
      { openedMs: 0, resolvedMs: undefined },
      { openedMs: 50, resolvedMs: 30 },
      { openedMs: 0, resolvedMs: 60 },
      { openedMs: 10, resolvedMs: 10 },
    ]);
    expect(stats).toEqual({
      resolvedCount: 2,
      openCount: 1,
      medianMs: 30,
      p90Ms: 60,
    });
  });

  it("returns all zeros for an empty list", () => {
    expect(computeResolutionStats([])).toEqual({
      resolvedCount: 0,
      openCount: 0,
      medianMs: 0,
      p90Ms: 0,
    });
  });

  it("counts open cases without producing durations", () => {
    const stats = computeResolutionStats([
      { openedMs: 0, resolvedMs: undefined },
      { openedMs: 5, resolvedMs: undefined },
    ]);
    expect(stats).toEqual({
      resolvedCount: 0,
      openCount: 2,
      medianMs: 0,
      p90Ms: 0,
    });
  });

  it("handles a single resolved case (median equals p90)", () => {
    const stats = computeResolutionStats([{ openedMs: 100, resolvedMs: 250 }]);
    expect(stats).toEqual({
      resolvedCount: 1,
      openCount: 0,
      medianMs: 150,
      p90Ms: 150,
    });
  });

  it("is order-independent: any input ordering yields the same stats", () => {
    const forward = computeResolutionStats([
      { openedMs: 0, resolvedMs: 50 },
      { openedMs: 0, resolvedMs: 10 },
      { openedMs: 0, resolvedMs: 90 },
      { openedMs: 0, resolvedMs: 30 },
      { openedMs: 0, resolvedMs: 20 },
    ]);
    const reversed = computeResolutionStats([
      { openedMs: 0, resolvedMs: 20 },
      { openedMs: 0, resolvedMs: 30 },
      { openedMs: 0, resolvedMs: 90 },
      { openedMs: 0, resolvedMs: 10 },
      { openedMs: 0, resolvedMs: 50 },
    ]);
    expect(forward).toEqual({
      resolvedCount: 5,
      openCount: 0,
      medianMs: 30,
      p90Ms: 90,
    });
    expect(reversed).toEqual(forward);
  });

  it("is deterministic across repeated calls on the same input", () => {
    const input = [
      { openedMs: 0, resolvedMs: 42 },
      { openedMs: 10, resolvedMs: 25 },
      { openedMs: 0, resolvedMs: undefined },
    ] as const;
    expect(computeResolutionStats(input)).toEqual(
      computeResolutionStats(input),
    );
  });

  it("uses nearest-rank for p90 with ten durations", () => {
    const stats = computeResolutionStats([
      { openedMs: 0, resolvedMs: 1 },
      { openedMs: 0, resolvedMs: 2 },
      { openedMs: 0, resolvedMs: 3 },
      { openedMs: 0, resolvedMs: 4 },
      { openedMs: 0, resolvedMs: 5 },
      { openedMs: 0, resolvedMs: 6 },
      { openedMs: 0, resolvedMs: 7 },
      { openedMs: 0, resolvedMs: 8 },
      { openedMs: 0, resolvedMs: 9 },
      { openedMs: 0, resolvedMs: 10 },
    ]);
    expect(stats).toEqual({
      resolvedCount: 10,
      openCount: 0,
      medianMs: 5.5,
      p90Ms: 9,
    });
  });

  it("drops inconsistent cases where resolvedMs is before openedMs", () => {
    const stats = computeResolutionStats([{ openedMs: 100, resolvedMs: 50 }]);
    expect(stats).toEqual({
      resolvedCount: 0,
      openCount: 0,
      medianMs: 0,
      p90Ms: 0,
    });
  });

  it("treats resolvedMs equal to openedMs as a zero-duration resolution", () => {
    const stats = computeResolutionStats([{ openedMs: 100, resolvedMs: 100 }]);
    expect(stats).toEqual({
      resolvedCount: 1,
      openCount: 0,
      medianMs: 0,
      p90Ms: 0,
    });
  });
});
