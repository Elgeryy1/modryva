import { describe, expect, it } from "vitest";
import { computeSeverityTrend } from "./severity-trend.js";

const cases = (
  values: readonly number[],
): readonly { readonly severity: number }[] =>
  values.map((severity) => ({ severity }));

describe("computeSeverityTrend", () => {
  it("reports sube when recent severity is higher", () => {
    const result = computeSeverityTrend(cases([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    expect(result).toEqual({ recentAvg: 8, earlierAvg: 3, direction: "sube" });
  });

  it("reports baja when recent severity is lower", () => {
    const result = computeSeverityTrend(cases([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]));
    expect(result).toEqual({ recentAvg: 3, earlierAvg: 8, direction: "baja" });
  });

  it("reports estable when both buckets are equal", () => {
    const result = computeSeverityTrend(cases([5, 5, 5, 5, 5, 5, 5, 5, 5, 5]));
    expect(result).toEqual({
      recentAvg: 5,
      earlierAvg: 5,
      direction: "estable",
    });
  });

  it("honours a custom window size", () => {
    const result = computeSeverityTrend(cases([1, 2, 3, 4]), { window: 2 });
    expect(result).toEqual({
      recentAvg: 3.5,
      earlierAvg: 1.5,
      direction: "sube",
    });
  });

  it("handles empty input as estable with zero averages", () => {
    const result = computeSeverityTrend([]);
    expect(result).toEqual({
      recentAvg: 0,
      earlierAvg: 0,
      direction: "estable",
    });
  });

  it("reports estable when there is no earlier bucket to compare", () => {
    const result = computeSeverityTrend(cases([1, 2]));
    expect(result).toEqual({
      recentAvg: 1.5,
      earlierAvg: 0,
      direction: "estable",
    });
  });

  it("rounds averages to 2 decimals", () => {
    const result = computeSeverityTrend(cases([1, 1, 1, 2, 2, 3]), {
      window: 3,
    });
    expect(result).toEqual({
      recentAvg: 2.33,
      earlierAvg: 1,
      direction: "sube",
    });
  });

  it("clamps a non-positive window to at least 1", () => {
    const result = computeSeverityTrend(cases([1, 2, 3, 4]), { window: 0 });
    expect(result).toEqual({ recentAvg: 4, earlierAvg: 3, direction: "sube" });
  });

  it("is deterministic across repeated calls", () => {
    const input = cases([2, 4, 6, 8, 3, 9]);
    const first = computeSeverityTrend(input, { window: 3 });
    const second = computeSeverityTrend(input, { window: 3 });
    expect(first).toEqual(second);
    expect(first.direction).toBe("sube");
  });
});
