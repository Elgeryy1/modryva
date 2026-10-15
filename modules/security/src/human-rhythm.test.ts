import { describe, expect, it } from "vitest";
import { detectInhumanRhythm } from "./human-rhythm.js";

describe("detectInhumanRhythm", () => {
  it("flags a perfectly regular rhythm as suspicious", () => {
    expect(detectInhumanRhythm([0, 1000, 2000, 3000, 4000])).toEqual({
      suspicious: true,
      intervalCount: 4,
      stdDevMs: 0,
    });
  });

  it("produces the same verdict regardless of input order", () => {
    const ordered = detectInhumanRhythm([0, 1000, 2000, 3000, 4000]);
    const shuffled = detectInhumanRhythm([4000, 0, 2000, 1000, 3000]);
    expect(shuffled).toEqual(ordered);
  });

  it("does not flag an irregular human rhythm above the threshold", () => {
    expect(detectInhumanRhythm([1000, 0, 2000, 0, 1000])).toEqual({
      suspicious: false,
      intervalCount: 4,
      stdDevMs: 500,
    });
  });

  it("rounds the standard deviation to an integer", () => {
    expect(detectInhumanRhythm([0, 100, 300, 600, 1500])).toEqual({
      suspicious: false,
      intervalCount: 4,
      stdDevMs: 311,
    });
  });

  it("is never suspicious with fewer than minSamples intervals", () => {
    expect(detectInhumanRhythm([0, 1000, 2000])).toEqual({
      suspicious: false,
      intervalCount: 2,
      stdDevMs: 0,
    });
  });

  it("handles an empty array", () => {
    expect(detectInhumanRhythm([])).toEqual({
      suspicious: false,
      intervalCount: 0,
      stdDevMs: 0,
    });
  });

  it("handles a single timestamp", () => {
    expect(detectInhumanRhythm([5000])).toEqual({
      suspicious: false,
      intervalCount: 0,
      stdDevMs: 0,
    });
  });

  it("honours a lower minSamples via options", () => {
    expect(detectInhumanRhythm([0, 1000, 2000], { minSamples: 2 })).toEqual({
      suspicious: true,
      intervalCount: 2,
      stdDevMs: 0,
    });
  });

  it("treats maxStdDevMs as a strict boundary", () => {
    const timestamps = [0, 100, 600, 700, 1200];
    expect(detectInhumanRhythm(timestamps)).toEqual({
      suspicious: true,
      intervalCount: 4,
      stdDevMs: 200,
    });
    expect(detectInhumanRhythm(timestamps, { maxStdDevMs: 200 })).toEqual({
      suspicious: false,
      intervalCount: 4,
      stdDevMs: 200,
    });
  });

  it("always returns an integer standard deviation", () => {
    const result = detectInhumanRhythm([0, 100, 300, 600, 1500]);
    expect(Number.isInteger(result.stdDevMs)).toBe(true);
  });
});
