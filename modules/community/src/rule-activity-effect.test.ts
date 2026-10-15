import { describe, expect, it } from "vitest";
import { computeRuleActivityEffect } from "./rule-activity-effect.js";

describe("computeRuleActivityEffect", () => {
  it("reports a rise in activity", () => {
    expect(computeRuleActivityEffect({ before: 100, after: 130 })).toEqual({
      delta: 30,
      pct: 30,
      effect: "subio",
    });
  });

  it("reports a drop in activity", () => {
    expect(computeRuleActivityEffect({ before: 100, after: 80 })).toEqual({
      delta: -20,
      pct: -20,
      effect: "bajo",
    });
  });

  it("reports no change", () => {
    expect(computeRuleActivityEffect({ before: 50, after: 50 })).toEqual({
      delta: 0,
      pct: 0,
      effect: "sin_cambio",
    });
  });

  it("guards a zero baseline", () => {
    expect(computeRuleActivityEffect({ before: 0, after: 10 })).toEqual({
      delta: 10,
      pct: 0,
      effect: "subio",
    });
  });

  it("rounds the percent", () => {
    expect(computeRuleActivityEffect({ before: 3, after: 4 }).pct).toBe(33);
  });
});
