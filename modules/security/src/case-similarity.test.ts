import { describe, expect, it } from "vitest";
import { findSimilarCases, type PastCase } from "./case-similarity.js";

const spamCases: readonly PastCase[] = [
  { id: "a", tags: ["spam", "flood"], action: "ban" },
  { id: "b", tags: ["spam"], action: "mute" },
  { id: "c", tags: ["flood", "raid"], action: "warn" },
  { id: "d", tags: ["scam"], action: "delete" },
];

const gradedCases: readonly PastCase[] = [
  { id: "p1", tags: ["a", "b", "c", "d"], action: "ban" },
  { id: "p2", tags: ["a", "b", "c"], action: "kick" },
  { id: "p3", tags: ["a", "b"], action: "mute" },
  { id: "p4", tags: ["a"], action: "warn" },
];

describe("findSimilarCases", () => {
  it("ranks past cases by Jaccard score descending", () => {
    expect(findSimilarCases({ tags: ["spam", "flood"] }, spamCases)).toEqual([
      { id: "a", action: "ban", score: 1 },
      { id: "b", action: "mute", score: 0.5 },
      { id: "c", action: "warn", score: 0.3333 },
    ]);
  });

  it("excludes cases with no shared tags", () => {
    const result = findSimilarCases({ tags: ["spam", "flood"] }, spamCases);
    expect(result.some((match) => match.id === "d")).toBe(false);
  });

  it("breaks score ties by id ascending", () => {
    const past: readonly PastCase[] = [
      { id: "z", tags: ["a"], action: "x" },
      { id: "m", tags: ["b"], action: "y" },
    ];
    expect(findSimilarCases({ tags: ["a", "b"] }, past)).toEqual([
      { id: "m", action: "y", score: 0.5 },
      { id: "z", action: "x", score: 0.5 },
    ]);
  });

  it("caps results at the default limit of 3", () => {
    expect(
      findSimilarCases({ tags: ["a", "b", "c", "d"] }, gradedCases),
    ).toEqual([
      { id: "p1", action: "ban", score: 1 },
      { id: "p2", action: "kick", score: 0.75 },
      { id: "p3", action: "mute", score: 0.5 },
    ]);
  });

  it("respects a custom limit", () => {
    expect(
      findSimilarCases({ tags: ["a", "b", "c", "d"] }, gradedCases, {
        limit: 2,
      }),
    ).toEqual([
      { id: "p1", action: "ban", score: 1 },
      { id: "p2", action: "kick", score: 0.75 },
    ]);
  });

  it("returns an empty list when the limit is zero or negative", () => {
    expect(
      findSimilarCases({ tags: ["a"] }, gradedCases, { limit: 0 }),
    ).toEqual([]);
    expect(
      findSimilarCases({ tags: ["a"] }, gradedCases, { limit: -5 }),
    ).toEqual([]);
  });

  it("returns an empty list for no past cases", () => {
    expect(findSimilarCases({ tags: ["spam"] }, [])).toEqual([]);
  });

  it("returns an empty list when the current case has no tags", () => {
    expect(findSimilarCases({ tags: [] }, spamCases)).toEqual([]);
  });

  it("normalizes casing and surrounding whitespace before matching", () => {
    const past: readonly PastCase[] = [
      { id: "a", tags: ["spam", "flood"], action: "ban" },
    ];
    expect(findSimilarCases({ tags: ["Spam", " FLOOD "] }, past)).toEqual([
      { id: "a", action: "ban", score: 1 },
    ]);
  });

  it("deduplicates repeated tags so scores are unaffected", () => {
    const past: readonly PastCase[] = [
      { id: "b", tags: ["spam", "spam"], action: "mute" },
    ];
    expect(findSimilarCases({ tags: ["spam", "spam", "flood"] }, past)).toEqual(
      [{ id: "b", action: "mute", score: 0.5 }],
    );
  });

  it("is deterministic and independent of input order", () => {
    const shuffled: readonly PastCase[] = [
      { id: "d", tags: ["scam"], action: "delete" },
      { id: "c", tags: ["flood", "raid"], action: "warn" },
      { id: "b", tags: ["spam"], action: "mute" },
      { id: "a", tags: ["spam", "flood"], action: "ban" },
    ];
    const first = findSimilarCases({ tags: ["spam", "flood"] }, spamCases);
    const second = findSimilarCases({ tags: ["spam", "flood"] }, shuffled);
    expect(second).toEqual(first);
  });
});
