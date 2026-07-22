import { describe, expect, it } from "vitest";
import { findPeakHour } from "./peak-hour-prediction.js";

describe("findPeakHour", () => {
  it("finds the hour with the most activity", () => {
    expect(findPeakHour([1, 5, 3, 9, 2])).toEqual({
      peakHour: 3,
      peakValue: 9,
    });
  });

  it("returns the first hour on ties", () => {
    expect(findPeakHour([4, 4, 4])).toEqual({ peakHour: 0, peakValue: 4 });
  });

  it("handles a single hour", () => {
    expect(findPeakHour([7])).toEqual({ peakHour: 0, peakValue: 7 });
  });

  it("returns -1 for an empty series", () => {
    expect(findPeakHour([])).toEqual({ peakHour: -1, peakValue: 0 });
  });

  it("handles all zeros", () => {
    expect(findPeakHour([0, 0, 0])).toEqual({ peakHour: 0, peakValue: 0 });
  });
});
