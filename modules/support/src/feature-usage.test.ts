import { describe, expect, it } from "vitest";
import {
  type FeatureUse,
  findUnusedFeatures,
  formatUnusedSuggestion,
} from "./feature-usage.js";

const f = (feature: string, uses: number, enabled: boolean): FeatureUse => ({
  feature,
  uses,
  enabled,
});

describe("findUnusedFeatures", () => {
  it("returns enabled features under the threshold", () => {
    const features = [f("casino", 0, true), f("trivia", 50, true)];
    expect(findUnusedFeatures(features, 5)).toEqual(["casino"]);
  });

  it("ignores disabled features even with zero uses", () => {
    expect(findUnusedFeatures([f("rss", 0, false)], 5)).toEqual([]);
  });

  it("uses strict less-than for the threshold boundary", () => {
    expect(findUnusedFeatures([f("polls", 5, true)], 5)).toEqual([]);
    expect(findUnusedFeatures([f("polls", 4, true)], 5)).toEqual(["polls"]);
  });

  it("preserves input order", () => {
    const features = [f("a", 0, true), f("b", 100, true), f("c", 1, true)];
    expect(findUnusedFeatures(features, 3)).toEqual(["a", "c"]);
  });

  it("clamps negative/non-finite uses to zero", () => {
    expect(findUnusedFeatures([f("x", -10, true)], 1)).toEqual(["x"]);
    expect(findUnusedFeatures([f("y", Number.NaN, true)], 1)).toEqual(["y"]);
  });

  it("returns empty for no features", () => {
    expect(findUnusedFeatures([], 5)).toEqual([]);
  });

  it("does not mutate the input", () => {
    const features = [f("a", 0, true)];
    findUnusedFeatures(features, 5);
    expect(features).toEqual([f("a", 0, true)]);
  });

  it("is deterministic", () => {
    const features = [f("a", 0, true), f("b", 2, true)];
    expect(findUnusedFeatures(features, 5)).toEqual(
      findUnusedFeatures(features, 5),
    );
  });
});

describe("formatUnusedSuggestion", () => {
  it("lists the unused features", () => {
    expect(formatUnusedSuggestion(["casino", "rss"])).toContain("casino, rss");
  });

  it("returns an all-in-use message when empty", () => {
    expect(formatUnusedSuggestion([])).toContain("se están usando");
  });
});
