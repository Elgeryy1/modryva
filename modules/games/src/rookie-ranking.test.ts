import { describe, expect, it } from "vitest";
import { separateRookieRanking } from "./rookie-ranking.js";

describe("separateRookieRanking", () => {
  it("splits rookies and veterans using the default 7-day boundary", () => {
    const result = separateRookieRanking([
      { id: "a", score: 10, ageDays: 3 },
      { id: "b", score: 20, ageDays: 30 },
      { id: "c", score: 15, ageDays: 7 },
      { id: "d", score: 5, ageDays: 8 },
    ]);
    expect(result).toEqual({
      rookies: [
        { id: "c", score: 15 },
        { id: "a", score: 10 },
      ],
      veterans: [
        { id: "b", score: 20 },
        { id: "d", score: 5 },
      ],
    });
  });

  it("treats the exact boundary day as a rookie (inclusive)", () => {
    const result = separateRookieRanking([{ id: "x", score: 1, ageDays: 7 }]);
    expect(result).toEqual({
      rookies: [{ id: "x", score: 1 }],
      veterans: [],
    });
  });

  it("honors a custom rookieMaxDays", () => {
    const result = separateRookieRanking(
      [
        { id: "a", score: 10, ageDays: 10 },
        { id: "b", score: 20, ageDays: 40 },
      ],
      { rookieMaxDays: 14 },
    );
    expect(result).toEqual({
      rookies: [{ id: "a", score: 10 }],
      veterans: [{ id: "b", score: 20 }],
    });
  });

  it("breaks score ties by id ascending in each list", () => {
    const result = separateRookieRanking([
      { id: "zeta", score: 50, ageDays: 1 },
      { id: "alpha", score: 50, ageDays: 2 },
      { id: "mid", score: 50, ageDays: 3 },
    ]);
    expect(result.rookies).toEqual([
      { id: "alpha", score: 50 },
      { id: "mid", score: 50 },
      { id: "zeta", score: 50 },
    ]);
    expect(result.veterans).toEqual([]);
  });

  it("returns empty lists for empty input", () => {
    expect(separateRookieRanking([])).toEqual({ rookies: [], veterans: [] });
  });

  it("puts everyone in veterans when rookieMaxDays is 0", () => {
    const result = separateRookieRanking(
      [
        { id: "a", score: 3, ageDays: 0 },
        { id: "b", score: 9, ageDays: 1 },
      ],
      { rookieMaxDays: 0 },
    );
    expect(result.rookies).toEqual([{ id: "a", score: 3 }]);
    expect(result.veterans).toEqual([{ id: "b", score: 9 }]);
  });

  it("handles negative scores while keeping descending order", () => {
    const result = separateRookieRanking([
      { id: "a", score: -5, ageDays: 2 },
      { id: "b", score: -1, ageDays: 2 },
      { id: "c", score: -10, ageDays: 2 },
    ]);
    expect(result.rookies).toEqual([
      { id: "b", score: -1 },
      { id: "a", score: -5 },
      { id: "c", score: -10 },
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [
      { id: "a", score: 1, ageDays: 1 },
      { id: "b", score: 2, ageDays: 1 },
    ];
    const snapshot = [...input];
    separateRookieRanking(input);
    expect(input).toEqual(snapshot);
  });

  it("is deterministic across repeated calls", () => {
    const players = [
      { id: "b", score: 7, ageDays: 2 },
      { id: "a", score: 7, ageDays: 20 },
      { id: "c", score: 12, ageDays: 2 },
    ];
    const first = separateRookieRanking(players);
    const second = separateRookieRanking(players);
    expect(first).toEqual(second);
    expect(first).toEqual({
      rookies: [
        { id: "c", score: 12 },
        { id: "b", score: 7 },
      ],
      veterans: [{ id: "a", score: 7 }],
    });
  });
});
