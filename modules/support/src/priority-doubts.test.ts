import { describe, expect, it } from "vitest";
import { type DoubtInput, rankDoubts, scoreDoubt } from "./priority-doubts.js";

describe("scoreDoubt", () => {
  it("returns zero for a clean, non-urgent, fresh doubt", () => {
    expect(scoreDoubt({ id: "a", urgent: false, ageMs: 0, upvotes: 0 })).toBe(
      0,
    );
  });

  it("combines urgent, age (full hours) and upvotes", () => {
    // 1000 (urgent) + 3 (3 full hours) + 20 (2 upvotes * 10) = 1023
    expect(
      scoreDoubt({ id: "q", urgent: true, ageMs: 10_800_000, upvotes: 2 }),
    ).toBe(1023);
  });

  it("counts age in full hours, flooring partial hours", () => {
    expect(
      scoreDoubt({ id: "h", urgent: false, ageMs: 3_599_999, upvotes: 0 }),
    ).toBe(0);
    expect(
      scoreDoubt({ id: "h", urgent: false, ageMs: 3_600_000, upvotes: 0 }),
    ).toBe(1);
    expect(
      scoreDoubt({ id: "h", urgent: false, ageMs: 7_199_999, upvotes: 0 }),
    ).toBe(1);
  });

  it("clamps negative ageMs and negative upvotes to zero", () => {
    expect(
      scoreDoubt({ id: "x", urgent: false, ageMs: -5000, upvotes: -3 }),
    ).toBe(0);
    // urgent still applies, negatives ignored: 1000 + 0 + 0
    expect(
      scoreDoubt({ id: "x", urgent: true, ageMs: -5000, upvotes: -3 }),
    ).toBe(1000);
  });
});

describe("rankDoubts", () => {
  it("ranks by priority descending (happy path)", () => {
    const input: readonly DoubtInput[] = [
      { id: "a", urgent: false, ageMs: 0, upvotes: 0 },
      { id: "b", urgent: true, ageMs: 0, upvotes: 0 },
      { id: "c", urgent: false, ageMs: 7_200_000, upvotes: 5 },
    ];
    expect(rankDoubts(input)).toEqual([
      { id: "b", priority: 1000 },
      { id: "c", priority: 52 },
      { id: "a", priority: 0 },
    ]);
  });

  it("breaks ties by id ascending", () => {
    const input: readonly DoubtInput[] = [
      { id: "z", urgent: false, ageMs: 0, upvotes: 3 },
      { id: "m", urgent: false, ageMs: 0, upvotes: 3 },
      { id: "a", urgent: false, ageMs: 0, upvotes: 3 },
    ];
    expect(rankDoubts(input)).toEqual([
      { id: "a", priority: 30 },
      { id: "m", priority: 30 },
      { id: "z", priority: 30 },
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(rankDoubts([])).toEqual([]);
  });

  it("is deterministic across repeated calls", () => {
    const input: readonly DoubtInput[] = [
      { id: "c", urgent: false, ageMs: 3_600_000, upvotes: 1 },
      { id: "a", urgent: true, ageMs: 0, upvotes: 0 },
      { id: "b", urgent: false, ageMs: 0, upvotes: 0 },
    ];
    const first = rankDoubts(input);
    const second = rankDoubts(input);
    expect(first).toEqual(second);
    expect(first).toEqual([
      { id: "a", priority: 1000 },
      { id: "c", priority: 11 },
      { id: "b", priority: 0 },
    ]);
  });

  it("does not mutate the input array", () => {
    const input: readonly DoubtInput[] = [
      { id: "b", urgent: true, ageMs: 0, upvotes: 0 },
      { id: "a", urgent: false, ageMs: 0, upvotes: 0 },
    ];
    const snapshot = [
      { id: "b", urgent: true, ageMs: 0, upvotes: 0 },
      { id: "a", urgent: false, ageMs: 0, upvotes: 0 },
    ];
    rankDoubts(input);
    expect(input).toEqual(snapshot);
  });
});
