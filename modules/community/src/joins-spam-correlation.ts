/** A day's join and spam counts. Pure and deterministic. */
export interface JoinSpamDay {
  readonly joins: number;
  readonly spam: number;
}

/** Options for correlateJoinsSpam. */
export interface JoinSpamOptions {
  readonly highJoinThreshold?: number;
}

/**
 * Whether high-join days carry more spam, with the average spam of each bucket.
 * Pure and deterministic.
 */
export interface JoinSpamCorrelation {
  readonly highJoinSpamAvg: number;
  readonly lowJoinSpamAvg: number;
  readonly correlated: boolean;
}

const DEFAULT_HIGH_JOIN_THRESHOLD = 10;

/** Average of a list rounded to 2 decimals; 0 for an empty list. */
const averageSpam = (values: readonly number[]): number =>
  values.length === 0
    ? 0
    : Math.round(
        (values.reduce((sum, value) => sum + value, 0) / values.length) * 100,
      ) / 100;

/**
 * Correlates new members with spam: splits days into high-join (joins >=
 * threshold, default 10) and low-join buckets and compares their average spam.
 * Reports correlated when both buckets have data and the high-join average is
 * more than 1.5x the low-join average. Pure and deterministic.
 */
export const correlateJoinsSpam = (
  days: readonly JoinSpamDay[],
  options?: JoinSpamOptions,
): JoinSpamCorrelation => {
  const threshold = options?.highJoinThreshold ?? DEFAULT_HIGH_JOIN_THRESHOLD;
  const high = days
    .filter((day) => day.joins >= threshold)
    .map((day) => day.spam);
  const low = days
    .filter((day) => day.joins < threshold)
    .map((day) => day.spam);
  const highJoinSpamAvg = averageSpam(high);
  const lowJoinSpamAvg = averageSpam(low);
  return {
    highJoinSpamAvg,
    lowJoinSpamAvg,
    correlated:
      high.length > 0 &&
      low.length > 0 &&
      highJoinSpamAvg > lowJoinSpamAvg * 1.5,
  };
};
