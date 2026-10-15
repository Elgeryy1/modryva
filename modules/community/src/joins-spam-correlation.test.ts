import { describe, expect, it } from "vitest";
import { correlateJoinsSpam } from "./joins-spam-correlation.js";

describe("correlateJoinsSpam", () => {
  it("reports a correlation when high-join days carry much more spam", () => {
    expect(
      correlateJoinsSpam([
        { joins: 20, spam: 10 },
        { joins: 15, spam: 8 },
        { joins: 2, spam: 1 },
        { joins: 1, spam: 1 },
      ]),
    ).toEqual({ highJoinSpamAvg: 9, lowJoinSpamAvg: 1, correlated: true });
  });

  it("does not correlate when spam is similar across buckets", () => {
    expect(
      correlateJoinsSpam([
        { joins: 20, spam: 3 },
        { joins: 2, spam: 3 },
      ]).correlated,
    ).toBe(false);
  });

  it("does not correlate without both buckets", () => {
    expect(
      correlateJoinsSpam([
        { joins: 20, spam: 10 },
        { joins: 15, spam: 8 },
      ]).correlated,
    ).toBe(false);
  });

  it("honors a custom threshold", () => {
    expect(
      correlateJoinsSpam(
        [
          { joins: 6, spam: 10 },
          { joins: 1, spam: 1 },
        ],
        { highJoinThreshold: 5 },
      ).correlated,
    ).toBe(true);
  });

  it("handles empty input", () => {
    expect(correlateJoinsSpam([])).toEqual({
      highJoinSpamAvg: 0,
      lowJoinSpamAvg: 0,
      correlated: false,
    });
  });
});
