/** A symbolic-title bid in virtual currency. Pure and deterministic. */
export interface TitleBid {
  readonly userId: number;
  readonly amount: number;
}

/**
 * Auction outcome: the winning user (undefined when there were no bids), the
 * winning amount and the runner-up amount (0 when there is none).
 * Pure and deterministic.
 */
export interface TitleAuctionResult {
  readonly winnerId: number | undefined;
  readonly winningBid: number;
  readonly secondBid: number;
}

/**
 * Resolves a symbolic-title auction. The highest bid wins; ties go to the
 * lowest userId. Returns the winning and second-highest amounts. With no bids
 * the winner is undefined and both amounts are 0. Does not mutate the input.
 * Pure and deterministic.
 */
export const resolveTitleAuction = (
  bids: readonly TitleBid[],
): TitleAuctionResult => {
  if (bids.length === 0) {
    return { winnerId: undefined, winningBid: 0, secondBid: 0 };
  }
  const sorted = [...bids].sort((a, b) => {
    if (b.amount !== a.amount) {
      return b.amount - a.amount;
    }
    return a.userId - b.userId;
  });
  const top = sorted[0];
  const second = sorted[1];
  return {
    winnerId: top?.userId,
    winningBid: top?.amount ?? 0,
    secondBid: second?.amount ?? 0,
  };
};
