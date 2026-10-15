import { describe, expect, it } from "vitest";
import { computeCardCollectionProgress } from "./collectible-cards.js";

describe("computeCardCollectionProgress", () => {
  it("computes partial progress with missing cards in season order", () => {
    expect(
      computeCardCollectionProgress(["a", "b"], ["a", "b", "c", "d"]),
    ).toEqual({
      ownedCount: 2,
      totalCount: 4,
      percent: 50,
      missing: ["c", "d"],
    });
  });

  it("returns full progress when every season card is owned", () => {
    expect(
      computeCardCollectionProgress(["a", "b", "c"], ["a", "b", "c"]),
    ).toEqual({
      ownedCount: 3,
      totalCount: 3,
      percent: 100,
      missing: [],
    });
  });

  it("returns zero progress for an empty owned list", () => {
    expect(computeCardCollectionProgress([], ["a", "b"])).toEqual({
      ownedCount: 0,
      totalCount: 2,
      percent: 0,
      missing: ["a", "b"],
    });
  });

  it("guards division when the season set is empty", () => {
    expect(computeCardCollectionProgress(["a", "b"], [])).toEqual({
      ownedCount: 0,
      totalCount: 0,
      percent: 0,
      missing: [],
    });
  });

  it("collapses duplicate ids in the season set", () => {
    expect(computeCardCollectionProgress(["a"], ["a", "a", "b"])).toEqual({
      ownedCount: 1,
      totalCount: 2,
      percent: 50,
      missing: ["b"],
    });
  });

  it("ignores owned cards that are not part of the season set", () => {
    expect(computeCardCollectionProgress(["a", "z"], ["a"])).toEqual({
      ownedCount: 1,
      totalCount: 1,
      percent: 100,
      missing: [],
    });
  });

  it("rounds the percent to the nearest integer", () => {
    expect(computeCardCollectionProgress(["a"], ["a", "b", "c"])).toEqual({
      ownedCount: 1,
      totalCount: 3,
      percent: 33,
      missing: ["b", "c"],
    });
  });

  it("preserves season-set order in missing even when scrambled", () => {
    const result = computeCardCollectionProgress(["a"], ["c", "a", "b"]);
    expect(result.missing).toEqual(["c", "b"]);
    expect(result.ownedCount).toBe(1);
    expect(result.totalCount).toBe(3);
  });

  it("is deterministic across repeated calls with the same inputs", () => {
    const owned = ["s1", "s3"];
    const total = ["s1", "s2", "s3", "s4"];
    const first = computeCardCollectionProgress(owned, total);
    const second = computeCardCollectionProgress(owned, total);
    expect(first).toEqual(second);
    expect(first).toEqual({
      ownedCount: 2,
      totalCount: 4,
      percent: 50,
      missing: ["s2", "s4"],
    });
  });

  it("handles both lists empty as zero progress", () => {
    expect(computeCardCollectionProgress([], [])).toEqual({
      ownedCount: 0,
      totalCount: 0,
      percent: 0,
      missing: [],
    });
  });
});
