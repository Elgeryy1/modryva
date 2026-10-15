/**
 * One calendar day of moderation activity: how many announcements were
 * posted and how many conflicts (reports, fights, removals) occurred.
 * Pure data, no behaviour.
 */
export interface AnnouncementConflictDay {
  /** Number of announcements posted that day (>= 0). */
  readonly announcements: number;
  /** Number of conflicts recorded that day (>= 0). */
  readonly conflicts: number;
}

/**
 * Correlation summary between announcements and conflicts across a window
 * of days. Averages are rounded to 2 decimals.
 */
export interface AnnouncementConflictCorrelation {
  /** Average conflicts on days that had at least one announcement. */
  readonly withAnnouncementAvg: number;
  /** Average conflicts on days with no announcements. */
  readonly withoutAnnouncementAvg: number;
  /** True when withAnnouncementAvg exceeds withoutAnnouncementAvg by over 50%. */
  readonly correlated: boolean;
}

/** Rounds a finite number to 2 decimals. Pure and deterministic. */
const roundTo2 = (value: number): number => Math.round(value * 100) / 100;

/** Averages a list of numbers, returning 0 for an empty list. Pure and deterministic. */
const averageOrZero = (values: readonly number[]): number => {
  if (values.length === 0) {
    return 0;
  }
  let sum = 0;
  for (const value of values) {
    sum += value;
  }
  return sum / values.length;
};

/**
 * Correlates announcements with conflicts. A day counts as "with
 * announcement" when it has at least one announcement. Compares the average
 * conflicts of announcement days against non-announcement days and flags a
 * correlation when the former is more than 1.5x the latter. Empty groups
 * average to 0; an empty input yields all zeros and no correlation.
 * Pure and deterministic.
 */
export const correlateAnnouncementsConflicts = (
  days: readonly AnnouncementConflictDay[],
): AnnouncementConflictCorrelation => {
  const withConflicts: number[] = [];
  const withoutConflicts: number[] = [];
  for (const day of days) {
    if (day.announcements > 0) {
      withConflicts.push(day.conflicts);
    } else {
      withoutConflicts.push(day.conflicts);
    }
  }
  const withAnnouncementAvg = roundTo2(averageOrZero(withConflicts));
  const withoutAnnouncementAvg = roundTo2(averageOrZero(withoutConflicts));
  return {
    withAnnouncementAvg,
    withoutAnnouncementAvg,
    correlated: withAnnouncementAvg > withoutAnnouncementAvg * 1.5,
  };
};
