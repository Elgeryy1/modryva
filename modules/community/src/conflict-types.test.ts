import { describe, expect, it } from "vitest";
import { tallyConflictTypes } from "./conflict-types.js";

describe("tallyConflictTypes", () => {
  it("counts and sorts by count desc with ties by type asc", () => {
    expect(
      tallyConflictTypes([
        { type: "spam" },
        { type: "spam" },
        { type: "insult" },
        { type: "flood" },
      ]),
    ).toEqual([
      { type: "spam", count: 2, percent: 50 },
      { type: "flood", count: 1, percent: 25 },
      { type: "insult", count: 1, percent: 25 },
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(tallyConflictTypes([])).toEqual([]);
  });

  it("handles a single record at 100 percent", () => {
    expect(tallyConflictTypes([{ type: "ban" }])).toEqual([
      { type: "ban", count: 1, percent: 100 },
    ]);
  });

  it("rounds percentages to the nearest integer", () => {
    expect(
      tallyConflictTypes([{ type: "a" }, { type: "a" }, { type: "b" }]),
    ).toEqual([
      { type: "a", count: 2, percent: 67 },
      { type: "b", count: 1, percent: 33 },
    ]);
  });

  it("does not force percentages to sum to 100", () => {
    const result = tallyConflictTypes([
      { type: "a" },
      { type: "b" },
      { type: "c" },
    ]);
    expect(result).toEqual([
      { type: "a", count: 1, percent: 33 },
      { type: "b", count: 1, percent: 33 },
      { type: "c", count: 1, percent: 33 },
    ]);
    expect(result.reduce((sum, row) => sum + row.percent, 0)).toBe(99);
  });

  it("treats types as case-sensitive and breaks ties in ASCII order", () => {
    expect(tallyConflictTypes([{ type: "spam" }, { type: "Spam" }])).toEqual([
      { type: "Spam", count: 1, percent: 50 },
      { type: "spam", count: 1, percent: 50 },
    ]);
  });

  it("groups scattered occurrences of the same type", () => {
    expect(
      tallyConflictTypes([
        { type: "a" },
        { type: "b" },
        { type: "a" },
        { type: "c" },
        { type: "a" },
        { type: "b" },
      ]),
    ).toEqual([
      { type: "a", count: 3, percent: 50 },
      { type: "b", count: 2, percent: 33 },
      { type: "c", count: 1, percent: 17 },
    ]);
  });

  it("orders equal counts purely by type ascending", () => {
    const result = tallyConflictTypes([
      { type: "zeta" },
      { type: "alpha" },
      { type: "mid" },
    ]);
    expect(result.map((row) => row.type)).toEqual(["alpha", "mid", "zeta"]);
  });

  it("is deterministic across repeated calls regardless of input order", () => {
    const first = tallyConflictTypes([
      { type: "flood" },
      { type: "spam" },
      { type: "spam" },
    ]);
    const second = tallyConflictTypes([
      { type: "spam" },
      { type: "flood" },
      { type: "spam" },
    ]);
    expect(first).toEqual(second);
    expect(first).toEqual([
      { type: "spam", count: 2, percent: 67 },
      { type: "flood", count: 1, percent: 33 },
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [{ type: "b" }, { type: "a" }];
    const snapshot = [...input];
    tallyConflictTypes(input);
    expect(input).toEqual(snapshot);
  });
});
