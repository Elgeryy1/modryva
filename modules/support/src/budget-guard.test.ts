import { describe, expect, it } from "vitest";
import {
  BUDGET_NEAR_LIMIT_RATIO,
  checkBudget,
  detectCostAnomaly,
} from "./budget-guard.js";

describe("checkBudget", () => {
  it("flags overBudget when spent reaches the limit", () => {
    const result = checkBudget({ spent: 100, limit: 100 });
    expect(result.overBudget).toBe(true);
    expect(result.nearLimit).toBe(false);
    expect(result.pct).toBe(1);
  });

  it("flags nearLimit at the ratio boundary without exceeding", () => {
    const result = checkBudget({ spent: 80, limit: 100 });
    expect(result.overBudget).toBe(false);
    expect(result.nearLimit).toBe(true);
    expect(result.pct).toBeCloseTo(BUDGET_NEAR_LIMIT_RATIO);
  });

  it("is calm well under the limit", () => {
    const result = checkBudget({ spent: 10, limit: 100 });
    expect(result.overBudget).toBe(false);
    expect(result.nearLimit).toBe(false);
    expect(result.pct).toBeCloseTo(0.1);
  });

  it("returns zeros for a non-positive limit", () => {
    expect(checkBudget({ spent: 50, limit: 0 })).toEqual({
      overBudget: false,
      nearLimit: false,
      pct: 0,
    });
  });

  it("clamps negative spent", () => {
    expect(checkBudget({ spent: -5, limit: 100 }).pct).toBe(0);
  });

  it("is deterministic", () => {
    const b = { spent: 42, limit: 100 };
    expect(checkBudget(b)).toEqual(checkBudget(b));
  });
});

describe("detectCostAnomaly", () => {
  it("flags a spike above the factor times the mean", () => {
    const result = detectCostAnomaly([10, 10, 10, 40], 3);
    expect(result.anomalous).toBe(true);
  });

  it("does not flag a steady spend", () => {
    expect(detectCostAnomaly([10, 12, 11, 13], 3).anomalous).toBe(false);
  });

  it("needs at least three samples", () => {
    expect(detectCostAnomaly([1, 100], 3).anomalous).toBe(false);
  });

  it("does not flag when the previous mean is zero", () => {
    expect(detectCostAnomaly([0, 0, 50], 3).anomalous).toBe(false);
  });

  it("defaults the factor when invalid", () => {
    expect(detectCostAnomaly([10, 10, 10, 40], 0).anomalous).toBe(true);
  });

  it("is deterministic", () => {
    const recent = [5, 5, 5, 30];
    expect(detectCostAnomaly(recent, 3)).toEqual(detectCostAnomaly(recent, 3));
  });
});
