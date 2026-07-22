/**
 * A single moderation report tagged as valid (a real infraction) or false
 * (a report that turned out to be unfounded).
 * Pure and deterministic.
 */
export interface ReportOutcome {
  readonly valid: boolean;
}

/**
 * Aggregated outcome of reviewing a batch of user reports: the total number of
 * reports, how many were valid, how many were false, and the valid ratio in
 * the closed range 0..1.
 * Pure and deterministic.
 */
export interface ReportValidity {
  readonly total: number;
  readonly validCount: number;
  readonly falseCount: number;
  readonly validRatio: number;
}

/**
 * Computes the ratio of valid vs false reports from a batch of outcomes.
 * validRatio equals validCount / total, expressed in 0..1 and rounded to two
 * decimals; an empty batch yields a ratio of 0. validCount plus falseCount
 * always equals total, and the input order never affects the result.
 * Pure and deterministic.
 */
export const computeReportValidity = (
  reports: readonly ReportOutcome[],
): ReportValidity => {
  let validCount = 0;
  for (const report of reports) {
    if (report.valid) {
      validCount += 1;
    }
  }
  const total = reports.length;
  const falseCount = total - validCount;
  const validRatio =
    total === 0 ? 0 : Math.round((validCount / total) * 100) / 100;
  return { total, validCount, falseCount, validRatio };
};
