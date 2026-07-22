/**
 * A single appeal record in a user's moderation appeal history.
 * `accepted` is true when the appeal was granted, false when rejected.
 * Pure data shape.
 */
export interface AppealHistoryRecord {
  readonly accepted: boolean;
}

/**
 * Aggregated summary of a user's appeal history: total appeals, how many
 * were accepted, how many rejected, and the acceptance rate.
 * Pure data shape.
 */
export interface AppealHistorySummary {
  readonly total: number;
  readonly accepted: number;
  readonly rejected: number;
  readonly acceptRate: number;
}

/**
 * Rounds a ratio to at most two decimal places using half-up rounding.
 * Internal helper, not exported. Pure and deterministic.
 */
const roundRate = (value: number): number => Math.round(value * 100) / 100;

/**
 * Summarizes a user's appeal history into totals and an acceptance rate.
 * `acceptRate` is accepted/total rounded to 2 decimals; when there are no
 * appeals the rate is 0. Does not mutate the input.
 * Pure and deterministic.
 */
export const summarizeAppealHistory = (
  appeals: readonly AppealHistoryRecord[],
): AppealHistorySummary => {
  let accepted = 0;
  for (const appeal of appeals) {
    if (appeal.accepted) {
      accepted += 1;
    }
  }
  const total = appeals.length;
  const rejected = total - accepted;
  const acceptRate = total === 0 ? 0 : roundRate(accepted / total);
  return { total, accepted, rejected, acceptRate };
};
