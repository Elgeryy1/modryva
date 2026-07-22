import { describe, expect, it } from "vitest";
import { computeGamesRetention } from "./games-retention.js";

describe("computeGamesRetention", () => {
  it("reports a positive impact when players retain better", () => {
    expect(
      computeGamesRetention({
        playersRetained: 80,
        playersTotal: 100,
        nonPlayersRetained: 50,
        nonPlayersTotal: 100,
      }),
    ).toEqual({ playerRate: 0.8, nonPlayerRate: 0.5, positive: true });
  });

  it("reports no positive impact when non-players retain better", () => {
    expect(
      computeGamesRetention({
        playersRetained: 40,
        playersTotal: 100,
        nonPlayersRetained: 60,
        nonPlayersTotal: 100,
      }).positive,
    ).toBe(false);
  });

  it("guards zero totals", () => {
    expect(
      computeGamesRetention({
        playersRetained: 0,
        playersTotal: 0,
        nonPlayersRetained: 0,
        nonPlayersTotal: 0,
      }),
    ).toEqual({ playerRate: 0, nonPlayerRate: 0, positive: false });
  });
});
