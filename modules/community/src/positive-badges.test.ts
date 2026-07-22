import { describe, expect, it } from "vitest";
import {
  type PositiveBadgeInput,
  selectPositiveBadges,
} from "./positive-badges.js";

describe("selectPositiveBadges", () => {
  it("returns ids of positive badges only, preserving input order", () => {
    const badges: readonly PositiveBadgeInput[] = [
      { id: "helper", positive: true },
      { id: "spammer", positive: false },
      { id: "veteran", positive: true },
    ];
    expect(selectPositiveBadges(badges)).toEqual(["helper", "veteran"]);
  });

  it("never leaks ids of negative badges", () => {
    const badges: readonly PositiveBadgeInput[] = [
      { id: "warned", positive: false },
      { id: "banned", positive: false },
    ];
    expect(selectPositiveBadges(badges)).toEqual([]);
  });

  it("returns an empty array for empty input", () => {
    expect(selectPositiveBadges([])).toEqual([]);
  });

  it("returns all ids in order when every badge is positive", () => {
    const badges: readonly PositiveBadgeInput[] = [
      { id: "a", positive: true },
      { id: "b", positive: true },
      { id: "c", positive: true },
    ];
    expect(selectPositiveBadges(badges)).toEqual(["a", "b", "c"]);
  });

  it("handles a single positive badge", () => {
    expect(selectPositiveBadges([{ id: "founder", positive: true }])).toEqual([
      "founder",
    ]);
  });

  it("handles a single negative badge", () => {
    expect(selectPositiveBadges([{ id: "muted", positive: false }])).toEqual(
      [],
    );
  });

  it("preserves duplicate positive ids in order (deterministic)", () => {
    const badges: readonly PositiveBadgeInput[] = [
      { id: "star", positive: true },
      { id: "star", positive: true },
    ];
    expect(selectPositiveBadges(badges)).toEqual(["star", "star"]);
  });

  it("is deterministic across repeated calls with the same input", () => {
    const badges: readonly PositiveBadgeInput[] = [
      { id: "kind", positive: true },
      { id: "toxic", positive: false },
      { id: "loyal", positive: true },
    ];
    const first = selectPositiveBadges(badges);
    const second = selectPositiveBadges(badges);
    expect(first).toEqual(second);
    expect(first).toEqual(["kind", "loyal"]);
  });

  it("does not mutate the input array", () => {
    const badges: readonly PositiveBadgeInput[] = [
      { id: "x", positive: true },
      { id: "y", positive: false },
    ];
    const snapshot = [...badges];
    selectPositiveBadges(badges);
    expect(badges).toEqual(snapshot);
  });
});
