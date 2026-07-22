import { describe, expect, it } from "vitest";
import { summarizeAppealHistory } from "./appeal-history.js";

describe("summarizeAppealHistory", () => {
  it("returns zeros for an empty history", () => {
    expect(summarizeAppealHistory([])).toEqual({
      total: 0,
      accepted: 0,
      rejected: 0,
      acceptRate: 0,
    });
  });

  it("counts a single accepted appeal", () => {
    expect(summarizeAppealHistory([{ accepted: true }])).toEqual({
      total: 1,
      accepted: 1,
      rejected: 0,
      acceptRate: 1,
    });
  });

  it("counts a single rejected appeal", () => {
    expect(summarizeAppealHistory([{ accepted: false }])).toEqual({
      total: 1,
      accepted: 0,
      rejected: 1,
      acceptRate: 0,
    });
  });

  it("computes a mixed history with a clean half rate", () => {
    expect(
      summarizeAppealHistory([
        { accepted: true },
        { accepted: false },
        { accepted: true },
        { accepted: false },
      ]),
    ).toEqual({ total: 4, accepted: 2, rejected: 2, acceptRate: 0.5 });
  });

  it("rounds the acceptance rate to two decimals", () => {
    expect(
      summarizeAppealHistory([
        { accepted: true },
        { accepted: false },
        { accepted: false },
      ]),
    ).toEqual({ total: 3, accepted: 1, rejected: 2, acceptRate: 0.33 });
  });

  it("rounds two thirds up to two decimals", () => {
    expect(
      summarizeAppealHistory([
        { accepted: true },
        { accepted: true },
        { accepted: false },
      ]),
    ).toEqual({ total: 3, accepted: 2, rejected: 1, acceptRate: 0.67 });
  });

  it("handles an all-accepted history", () => {
    expect(
      summarizeAppealHistory([{ accepted: true }, { accepted: true }]),
    ).toEqual({ total: 2, accepted: 2, rejected: 0, acceptRate: 1 });
  });

  it("handles an all-rejected history", () => {
    expect(
      summarizeAppealHistory([
        { accepted: false },
        { accepted: false },
        { accepted: false },
      ]),
    ).toEqual({ total: 3, accepted: 0, rejected: 3, acceptRate: 0 });
  });

  it("does not mutate the input array", () => {
    const input = [{ accepted: true }, { accepted: false }] as const;
    const copy = [...input];
    summarizeAppealHistory(input);
    expect(input).toEqual(copy);
  });

  it("is deterministic across repeated calls", () => {
    const input = [
      { accepted: true },
      { accepted: false },
      { accepted: true },
    ] as const;
    const first = summarizeAppealHistory(input);
    const second = summarizeAppealHistory(input);
    expect(first).toEqual(second);
    expect(first).toEqual({
      total: 3,
      accepted: 2,
      rejected: 1,
      acceptRate: 0.67,
    });
  });
});
