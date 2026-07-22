import { describe, expect, it } from "vitest";
import { rankRevertedActions } from "./reverted-actions-ranking.js";

describe("rankRevertedActions", () => {
  it("tallies per type and sorts by reverted count descending", () => {
    expect(
      rankRevertedActions([
        { type: "ban", reverted: true },
        { type: "ban", reverted: false },
        { type: "ban", reverted: true },
        { type: "mute", reverted: true },
        { type: "warn", reverted: false },
      ]),
    ).toEqual([
      { type: "ban", reverted: 2, total: 3, rate: 0.67 },
      { type: "mute", reverted: 1, total: 1, rate: 1 },
      { type: "warn", reverted: 0, total: 1, rate: 0 },
    ]);
  });

  it("returns an empty ranking for empty input", () => {
    expect(rankRevertedActions([])).toEqual([]);
  });

  it("handles a single action", () => {
    expect(rankRevertedActions([{ type: "kick", reverted: true }])).toEqual([
      { type: "kick", reverted: 1, total: 1, rate: 1 },
    ]);
  });

  it("gives rate 0 when nothing of a type was reverted", () => {
    expect(
      rankRevertedActions([
        { type: "warn", reverted: false },
        { type: "warn", reverted: false },
      ]),
    ).toEqual([{ type: "warn", reverted: 0, total: 2, rate: 0 }]);
  });

  it("rounds the rate to two decimals (2/3)", () => {
    const [rank] = rankRevertedActions([
      { type: "ban", reverted: true },
      { type: "ban", reverted: true },
      { type: "ban", reverted: false },
    ]);
    expect(rank).toEqual({ type: "ban", reverted: 2, total: 3, rate: 0.67 });
  });

  it("rounds a hundredths boundary half up (1/8 -> 0.13)", () => {
    const [rank] = rankRevertedActions([
      { type: "mute", reverted: true },
      { type: "mute", reverted: false },
      { type: "mute", reverted: false },
      { type: "mute", reverted: false },
      { type: "mute", reverted: false },
      { type: "mute", reverted: false },
      { type: "mute", reverted: false },
      { type: "mute", reverted: false },
    ]);
    expect(rank).toEqual({ type: "mute", reverted: 1, total: 8, rate: 0.13 });
  });

  it("breaks ties on reverted count by type ascending", () => {
    expect(
      rankRevertedActions([
        { type: "zeta", reverted: true },
        { type: "alpha", reverted: true },
        { type: "mu", reverted: true },
      ]),
    ).toEqual([
      { type: "alpha", reverted: 1, total: 1, rate: 1 },
      { type: "mu", reverted: 1, total: 1, rate: 1 },
      { type: "zeta", reverted: 1, total: 1, rate: 1 },
    ]);
  });

  it("orders by reverted count, not by rate", () => {
    const result = rankRevertedActions([
      { type: "high-rate", reverted: true },
      { type: "many-reverts", reverted: true },
      { type: "many-reverts", reverted: true },
      { type: "many-reverts", reverted: false },
    ]);
    expect(result).toEqual([
      { type: "many-reverts", reverted: 2, total: 3, rate: 0.67 },
      { type: "high-rate", reverted: 1, total: 1, rate: 1 },
    ]);
  });

  it("is deterministic across repeated calls", () => {
    const input = [
      { type: "b", reverted: true },
      { type: "a", reverted: true },
      { type: "b", reverted: false },
    ];
    const first = rankRevertedActions(input);
    const second = rankRevertedActions(input);
    expect(first).toEqual(second);
    expect(first.map((r) => r.type)).toEqual(["a", "b"]);
  });

  it("does not mutate the input array", () => {
    const input = [
      { type: "ban", reverted: true },
      { type: "mute", reverted: false },
    ];
    const snapshot = JSON.parse(JSON.stringify(input));
    rankRevertedActions(input);
    expect(input).toEqual(snapshot);
  });
});
