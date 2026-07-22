/** A prize won by a user. Pure and deterministic. */
export interface PrizeWin {
  readonly userId: number;
  readonly prize: number;
}

/** Options for flagSuspiciousPrizes. */
export interface SuspiciousPrizeOptions {
  readonly multipleOfMedian?: number;
}

const DEFAULT_PRIZE_MULTIPLE = 10;

/** Median of a list of numbers; 0 for an empty list. */
const medianPrize = (values: readonly number[]): number => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? 0;
  }
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
};

/**
 * Flags prizes that dwarf the median win: any prize strictly above
 * median * multipleOfMedian (default 10). Flagged prizes are sorted by prize
 * descending, then userId ascending. Does not mutate the input.
 * Pure and deterministic.
 */
export const flagSuspiciousPrizes = (
  wins: readonly PrizeWin[],
  options?: SuspiciousPrizeOptions,
): readonly PrizeWin[] => {
  const multipleOfMedian = options?.multipleOfMedian ?? DEFAULT_PRIZE_MULTIPLE;
  const threshold =
    medianPrize(wins.map((win) => win.prize)) * multipleOfMedian;
  return wins
    .filter((win) => win.prize > threshold)
    .sort((a, b) => {
      if (b.prize !== a.prize) {
        return b.prize - a.prize;
      }
      return a.userId - b.userId;
    });
};
