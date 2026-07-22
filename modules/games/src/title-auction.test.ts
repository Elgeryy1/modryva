import { describe, expect, it } from "vitest";
import { resolveTitleAuction } from "./title-auction.js";

describe("resolveTitleAuction", () => {
  it("awards the title to the highest bidder", () => {
    expect(
      resolveTitleAuction([
        { userId: 1, amount: 10 },
        { userId: 2, amount: 30 },
        { userId: 3, amount: 20 },
      ]),
    ).toEqual({ winnerId: 2, winningBid: 30, secondBid: 20 });
  });

  it("breaks amount ties by lowest userId", () => {
    expect(
      resolveTitleAuction([
        { userId: 5, amount: 10 },
        { userId: 2, amount: 10 },
      ]),
    ).toEqual({ winnerId: 2, winningBid: 10, secondBid: 10 });
  });

  it("reports zero second bid for a single bid", () => {
    expect(resolveTitleAuction([{ userId: 1, amount: 7 }])).toEqual({
      winnerId: 1,
      winningBid: 7,
      secondBid: 0,
    });
  });

  it("returns an undefined winner for no bids", () => {
    expect(resolveTitleAuction([])).toEqual({
      winnerId: undefined,
      winningBid: 0,
      secondBid: 0,
    });
  });

  it("does not mutate input", () => {
    const input = [
      { userId: 1, amount: 5 },
      { userId: 2, amount: 9 },
    ];
    const snapshot = JSON.parse(JSON.stringify(input));
    resolveTitleAuction(input);
    expect(input).toEqual(snapshot);
  });
});
