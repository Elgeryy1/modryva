/** A day's announcement count and how many members left. */
export interface AnnounceAbandonDay {
  readonly announcements: number;
  readonly leaves: number;
}

/** Options for correlateAnnounceAbandon. */
export interface AnnounceAbandonOptions {
  readonly highAnnounceThreshold?: number;
}

/**
 * Whether heavy-announcement days coincide with more departures, with the
 * average leaves of each bucket. Pure and deterministic.
 */
export interface AnnounceAbandonResult {
  readonly highAnnounceLeavesAvg: number;
  readonly lowAnnounceLeavesAvg: number;
  readonly correlated: boolean;
}

const DEFAULT_HIGH_ANNOUNCE_THRESHOLD = 3;

const averageLeaves = (values: readonly number[]): number =>
  values.length === 0
    ? 0
    : Math.round(
        (values.reduce((sum, value) => sum + value, 0) / values.length) * 100,
      ) / 100;

/**
 * Correlates announcements with abandonment: splits days into heavy-announce
 * (>= threshold, default 3) and light-announce buckets and compares their
 * average departures. Reports correlated when both buckets have data and the
 * heavy-announce average exceeds 1.5x the light one. Pure and deterministic.
 */
export const correlateAnnounceAbandon = (
  days: readonly AnnounceAbandonDay[],
  options?: AnnounceAbandonOptions,
): AnnounceAbandonResult => {
  const threshold =
    options?.highAnnounceThreshold ?? DEFAULT_HIGH_ANNOUNCE_THRESHOLD;
  const high = days
    .filter((day) => day.announcements >= threshold)
    .map((day) => day.leaves);
  const low = days
    .filter((day) => day.announcements < threshold)
    .map((day) => day.leaves);
  const highAnnounceLeavesAvg = averageLeaves(high);
  const lowAnnounceLeavesAvg = averageLeaves(low);
  return {
    highAnnounceLeavesAvg,
    lowAnnounceLeavesAvg,
    correlated:
      high.length > 0 &&
      low.length > 0 &&
      highAnnounceLeavesAvg > lowAnnounceLeavesAvg * 1.5,
  };
};
