/**
 * A single economy-history entry for a user. A positive delta is a credit
 * (earned) and a negative delta is a debit (spent). Zero is a no-op.
 * Pure and deterministic.
 */
export interface EconomyHistoryEntry {
  readonly delta: number;
}

/**
 * Aggregated economy figures for a user's history.
 * earned is the sum of positive deltas, spent is the sum of the absolute
 * values of negative deltas, and balance is earned minus spent.
 * Pure and deterministic.
 */
export interface EconomyHistorySummary {
  readonly earned: number;
  readonly spent: number;
  readonly balance: number;
}

/**
 * Summarizes a user's economy history into earned, spent and balance totals.
 * Non-finite or zero deltas are ignored. Order of entries does not affect the
 * result. Empty input yields all-zero totals.
 * Pure and deterministic.
 */
export const summarizeEconomyHistory = (
  entries: readonly EconomyHistoryEntry[],
): EconomyHistorySummary => {
  let earned = 0;
  let spent = 0;
  for (const entry of entries) {
    const delta = entry.delta;
    if (!Number.isFinite(delta) || delta === 0) {
      continue;
    }
    if (delta > 0) {
      earned += delta;
    } else {
      spent += -delta;
    }
  }
  return { earned, spent, balance: earned - spent };
};
