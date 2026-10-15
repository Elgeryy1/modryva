import { describe, expect, it } from "vitest";
import { summarizeEconomyHistory } from "./economy-history.js";

describe("summarizeEconomyHistory", () => {
  it("sums positives as earned and abs of negatives as spent", () => {
    expect(
      summarizeEconomyHistory([
        { delta: 100 },
        { delta: -30 },
        { delta: 50 },
        { delta: -20 },
      ]),
    ).toEqual({ earned: 150, spent: 50, balance: 100 });
  });

  it("returns all zeros for empty input", () => {
    expect(summarizeEconomyHistory([])).toEqual({
      earned: 0,
      spent: 0,
      balance: 0,
    });
  });

  it("handles only earnings", () => {
    expect(summarizeEconomyHistory([{ delta: 10 }, { delta: 5 }])).toEqual({
      earned: 15,
      spent: 0,
      balance: 15,
    });
  });

  it("handles only spending, yielding a negative balance", () => {
    expect(summarizeEconomyHistory([{ delta: -10 }, { delta: -5 }])).toEqual({
      earned: 0,
      spent: 15,
      balance: -15,
    });
  });

  it("ignores zero deltas", () => {
    expect(
      summarizeEconomyHistory([{ delta: 0 }, { delta: 40 }, { delta: 0 }]),
    ).toEqual({ earned: 40, spent: 0, balance: 40 });
  });

  it("ignores non-finite deltas", () => {
    expect(
      summarizeEconomyHistory([
        { delta: Number.NaN },
        { delta: Number.POSITIVE_INFINITY },
        { delta: Number.NEGATIVE_INFINITY },
        { delta: 25 },
      ]),
    ).toEqual({ earned: 25, spent: 0, balance: 25 });
  });

  it("balances to zero when earnings equal spending", () => {
    expect(summarizeEconomyHistory([{ delta: 60 }, { delta: -60 }])).toEqual({
      earned: 60,
      spent: 60,
      balance: 0,
    });
  });

  it("supports fractional deltas", () => {
    expect(summarizeEconomyHistory([{ delta: 1.5 }, { delta: -0.5 }])).toEqual({
      earned: 1.5,
      spent: 0.5,
      balance: 1,
    });
  });

  it("is independent of entry order", () => {
    const forward = summarizeEconomyHistory([
      { delta: 10 },
      { delta: -4 },
      { delta: 7 },
    ]);
    const reversed = summarizeEconomyHistory([
      { delta: 7 },
      { delta: -4 },
      { delta: 10 },
    ]);
    expect(forward).toEqual(reversed);
    expect(forward).toEqual({ earned: 17, spent: 4, balance: 13 });
  });
});
