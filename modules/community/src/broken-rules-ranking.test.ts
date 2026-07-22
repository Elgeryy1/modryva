import { describe, expect, it } from "vitest";
import { rankBrokenRules } from "./broken-rules-ranking.js";

describe("rankBrokenRules", () => {
  it("ranks rules by count descending", () => {
    expect(
      rankBrokenRules([
        { ruleId: "spam", ruleName: "No spam" },
        { ruleId: "spam", ruleName: "No spam" },
        { ruleId: "flood", ruleName: "No flood" },
      ]),
    ).toEqual([
      { ruleId: "spam", ruleName: "No spam", count: 2 },
      { ruleId: "flood", ruleName: "No flood", count: 1 },
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(rankBrokenRules([])).toEqual([]);
  });

  it("handles a single violation", () => {
    expect(rankBrokenRules([{ ruleId: "nsfw", ruleName: "No NSFW" }])).toEqual([
      { ruleId: "nsfw", ruleName: "No NSFW", count: 1 },
    ]);
  });

  it("breaks count ties by ruleName ascending", () => {
    expect(
      rankBrokenRules([
        { ruleId: "b", ruleName: "Beta" },
        { ruleId: "a", ruleName: "Alfa" },
      ]),
    ).toEqual([
      { ruleId: "a", ruleName: "Alfa", count: 1 },
      { ruleId: "b", ruleName: "Beta", count: 1 },
    ]);
  });

  it("keeps the first-seen ruleName for a repeated ruleId", () => {
    expect(
      rankBrokenRules([
        { ruleId: "x", ruleName: "First name" },
        { ruleId: "x", ruleName: "Second name" },
      ]),
    ).toEqual([{ ruleId: "x", ruleName: "First name", count: 2 }]);
  });

  it("uses locale-agnostic codepoint comparison for ties", () => {
    // 'Z' (90) sorts before 'a' (97) under a plain `<` comparison.
    expect(
      rankBrokenRules([
        { ruleId: "z", ruleName: "Zebra" },
        { ruleId: "a", ruleName: "apple" },
      ]),
    ).toEqual([
      { ruleId: "z", ruleName: "Zebra", count: 1 },
      { ruleId: "a", ruleName: "apple", count: 1 },
    ]);
  });

  it("orders mixed counts and ties correctly", () => {
    expect(
      rankBrokenRules([
        { ruleId: "c", ruleName: "Cee" },
        { ruleId: "a", ruleName: "Aaa" },
        { ruleId: "a", ruleName: "Aaa" },
        { ruleId: "b", ruleName: "Bbb" },
        { ruleId: "b", ruleName: "Bbb" },
      ]),
    ).toEqual([
      { ruleId: "a", ruleName: "Aaa", count: 2 },
      { ruleId: "b", ruleName: "Bbb", count: 2 },
      { ruleId: "c", ruleName: "Cee", count: 1 },
    ]);
  });

  it("sorts a three-way tie by ruleName ascending", () => {
    expect(
      rankBrokenRules([
        { ruleId: "3", ruleName: "gamma" },
        { ruleId: "1", ruleName: "alpha" },
        { ruleId: "2", ruleName: "beta" },
      ]),
    ).toEqual([
      { ruleId: "1", ruleName: "alpha", count: 1 },
      { ruleId: "2", ruleName: "beta", count: 1 },
      { ruleId: "3", ruleName: "gamma", count: 1 },
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [
      { ruleId: "b", ruleName: "Beta" },
      { ruleId: "a", ruleName: "Alfa" },
    ];
    const snapshot = [
      { ruleId: "b", ruleName: "Beta" },
      { ruleId: "a", ruleName: "Alfa" },
    ];
    rankBrokenRules(input);
    expect(input).toEqual(snapshot);
  });

  it("is deterministic regardless of input order for ties", () => {
    const forward = rankBrokenRules([
      { ruleId: "b", ruleName: "Beta" },
      { ruleId: "a", ruleName: "Alfa" },
    ]);
    const reversed = rankBrokenRules([
      { ruleId: "a", ruleName: "Alfa" },
      { ruleId: "b", ruleName: "Beta" },
    ]);
    expect(forward).toEqual(reversed);
    expect(forward).toEqual([
      { ruleId: "a", ruleName: "Alfa", count: 1 },
      { ruleId: "b", ruleName: "Beta", count: 1 },
    ]);
  });
});
