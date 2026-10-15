import { describe, expect, it } from "vitest";
import { detectLastStraw } from "./last-straw.js";

describe("detectLastStraw", () => {
  it("flags an at-risk user with a climbing trend", () => {
    expect(detectLastStraw([3, 4, 5])).toEqual({
      atRisk: true,
      accumulated: 12,
      trendingUp: true,
    });
  });

  it("does not flag trendingUp when the last day equals the previous one", () => {
    expect(detectLastStraw([5, 5, 5])).toEqual({
      atRisk: true,
      accumulated: 15,
      trendingUp: false,
    });
  });

  it("stays not at risk when there are fewer days than minDays", () => {
    expect(detectLastStraw([10, 20])).toEqual({
      atRisk: false,
      accumulated: 30,
      trendingUp: true,
    });
  });

  it("stays not at risk when accumulated friction is below the threshold", () => {
    expect(detectLastStraw([1, 2, 3])).toEqual({
      atRisk: false,
      accumulated: 6,
      trendingUp: true,
    });
  });

  it("treats the threshold boundary as at risk (>=)", () => {
    expect(detectLastStraw([4, 3, 3])).toEqual({
      atRisk: true,
      accumulated: 10,
      trendingUp: false,
    });
  });

  it("honours custom threshold and minDays options", () => {
    expect(detectLastStraw([3, 3], { threshold: 5, minDays: 2 })).toEqual({
      atRisk: true,
      accumulated: 6,
      trendingUp: false,
    });
  });

  it("returns a calm verdict for an empty series", () => {
    expect(detectLastStraw([])).toEqual({
      atRisk: false,
      accumulated: 0,
      trendingUp: false,
    });
  });

  it("never trends up for a single day", () => {
    expect(detectLastStraw([99])).toEqual({
      atRisk: false,
      accumulated: 99,
      trendingUp: false,
    });
  });

  it("detects a downward trend as not trending up", () => {
    expect(detectLastStraw([9, 5, 1])).toEqual({
      atRisk: true,
      accumulated: 15,
      trendingUp: false,
    });
  });

  it("supports negative friction adjustments in the sum", () => {
    expect(detectLastStraw([8, -2, 6])).toEqual({
      atRisk: true,
      accumulated: 12,
      trendingUp: true,
    });
  });

  it("is deterministic across repeated calls with the same input", () => {
    const series = [2, 4, 6, 8];
    const first = detectLastStraw(series);
    const second = detectLastStraw(series);
    expect(first).toEqual(second);
    expect(first).toEqual({ atRisk: true, accumulated: 20, trendingUp: true });
  });
});
