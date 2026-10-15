import { describe, expect, it } from "vitest";
import { detectOveraggressiveRules } from "./overaggressive-rules.js";

describe("detectOveraggressiveRules", () => {
  it("flags a rule whose legit share exceeds the threshold", () => {
    expect(
      detectOveraggressiveRules([{ name: "links", blocked: 10, legit: 8 }]),
    ).toEqual([{ name: "links", legitRatio: 0.8 }]);
  });

  it("excludes rules below minBlocked even with a high legit ratio", () => {
    expect(
      detectOveraggressiveRules([{ name: "spam", blocked: 3, legit: 3 }]),
    ).toEqual([]);
  });

  it("excludes rules whose legit ratio is below maxLegitRatio", () => {
    expect(
      detectOveraggressiveRules([{ name: "caps", blocked: 10, legit: 2 }]),
    ).toEqual([]);
  });

  it("rounds legitRatio to 2 decimals", () => {
    expect(
      detectOveraggressiveRules([{ name: "urls", blocked: 6, legit: 4 }]),
    ).toEqual([{ name: "urls", legitRatio: 0.67 }]);
  });

  it("sorts by legitRatio descending", () => {
    const result = detectOveraggressiveRules([
      { name: "a", blocked: 10, legit: 6 },
      { name: "b", blocked: 10, legit: 9 },
    ]);
    expect(result).toEqual([
      { name: "b", legitRatio: 0.9 },
      { name: "a", legitRatio: 0.6 },
    ]);
  });

  it("breaks legitRatio ties by name ascending", () => {
    const result = detectOveraggressiveRules([
      { name: "zeta", blocked: 10, legit: 7 },
      { name: "alpha", blocked: 10, legit: 7 },
    ]);
    expect(result).toEqual([
      { name: "alpha", legitRatio: 0.7 },
      { name: "zeta", legitRatio: 0.7 },
    ]);
  });

  it("includes a rule exactly at both boundaries", () => {
    expect(
      detectOveraggressiveRules([{ name: "edge", blocked: 5, legit: 3 }]),
    ).toEqual([{ name: "edge", legitRatio: 0.6 }]);
  });

  it("skips rules with zero or negative blocked counts", () => {
    expect(
      detectOveraggressiveRules([
        { name: "empty", blocked: 0, legit: 0 },
        { name: "bad", blocked: -5, legit: 10 },
      ]),
    ).toEqual([]);
  });

  it("returns an empty array for empty input", () => {
    expect(detectOveraggressiveRules([])).toEqual([]);
  });

  it("honours custom options", () => {
    const rules = [
      { name: "strict", blocked: 4, legit: 2 },
      { name: "loose", blocked: 20, legit: 6 },
    ];
    expect(
      detectOveraggressiveRules(rules, { minBlocked: 3, maxLegitRatio: 0.25 }),
    ).toEqual([
      { name: "strict", legitRatio: 0.5 },
      { name: "loose", legitRatio: 0.3 },
    ]);
  });

  it("is deterministic across repeated calls", () => {
    const rules = [
      { name: "b", blocked: 10, legit: 8 },
      { name: "a", blocked: 10, legit: 8 },
      { name: "c", blocked: 10, legit: 9 },
    ];
    const first = detectOveraggressiveRules(rules);
    const second = detectOveraggressiveRules(rules);
    expect(first).toEqual(second);
    expect(first).toEqual([
      { name: "c", legitRatio: 0.9 },
      { name: "a", legitRatio: 0.8 },
      { name: "b", legitRatio: 0.8 },
    ]);
  });
});
