import { describe, expect, it } from "vitest";
import { detectInflation } from "./inflation-alert.js";

describe("detectInflation", () => {
  it("flags inflation when growth exceeds the default threshold", () => {
    expect(detectInflation([100, 150])).toEqual({
      inflating: true,
      growthRate: 0.5,
    });
  });

  it("does not flag when growth exactly equals the threshold", () => {
    expect(detectInflation([100, 120])).toEqual({
      inflating: false,
      growthRate: 0.2,
    });
  });

  it("does not flag mild growth below the threshold", () => {
    expect(detectInflation([100, 110])).toEqual({
      inflating: false,
      growthRate: 0.1,
    });
  });

  it("reports deflation as a negative growth rate and never inflating", () => {
    expect(detectInflation([100, 50])).toEqual({
      inflating: false,
      growthRate: -0.5,
    });
  });

  it("treats a flat supply as zero growth", () => {
    expect(detectInflation([100, 100])).toEqual({
      inflating: false,
      growthRate: 0,
    });
  });

  it("respects a higher custom threshold", () => {
    expect(detectInflation([100, 150], { growthThreshold: 0.6 })).toEqual({
      inflating: false,
      growthRate: 0.5,
    });
  });

  it("respects a lower custom threshold", () => {
    expect(detectInflation([100, 110], { growthThreshold: 0.05 })).toEqual({
      inflating: true,
      growthRate: 0.1,
    });
  });

  it("returns a neutral report for an empty history", () => {
    expect(detectInflation([])).toEqual({ inflating: false, growthRate: 0 });
  });

  it("returns a neutral report for a single sample", () => {
    expect(detectInflation([100])).toEqual({ inflating: false, growthRate: 0 });
  });

  it("guards against a first sample of 0 (undefined ratio)", () => {
    expect(detectInflation([0, 500])).toEqual({
      inflating: false,
      growthRate: 0,
    });
  });

  it("uses only the first and last samples, ignoring the middle of the window", () => {
    expect(detectInflation([100, 5000, 150])).toEqual({
      inflating: true,
      growthRate: 0.5,
    });
  });

  it("is deterministic and order-sensitive across repeated calls", () => {
    const forward = detectInflation([100, 200]);
    expect(detectInflation([100, 200])).toEqual(forward);
    expect(forward).toEqual({ inflating: true, growthRate: 1 });
    expect(detectInflation([200, 100])).toEqual({
      inflating: false,
      growthRate: -0.5,
    });
  });
});
