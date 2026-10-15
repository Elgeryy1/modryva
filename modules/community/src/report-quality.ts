/**
 * Report-quality scoring: rate reporters by their ratio of valid vs. invalid
 * reports so moderators can weigh (or ignore) chronic false-reporters. Pure
 * logic: every function takes plain inputs and returns plain values, with no
 * I/O, clock or randomness.
 */

/**
 * A reporter's tally. `valid` counts reports that a moderator confirmed as
 * actionable; `invalid` counts reports dismissed as false. Both are expected to
 * be non-negative; negative or fractional values are tolerated but should not
 * occur in normal use.
 */
export interface Reporter {
  readonly userId: string;
  readonly valid: number;
  readonly invalid: number;
}

/** A reporter paired with its computed accuracy, used for ranking. */
export interface RankedReporter {
  readonly userId: string;
  readonly accuracy: number;
}

/**
 * Accuracy of a reporter as `valid / (valid + invalid)`, always within 0..1.
 * A reporter with no reports at all (total <= 0) scores 0 instead of dividing
 * by zero. Negative tallies are clamped to 0 so the result never leaves 0..1.
 */
export const reporterAccuracy = (r: Reporter): number => {
  const valid = r.valid > 0 ? r.valid : 0;
  const invalid = r.invalid > 0 ? r.invalid : 0;
  const total = valid + invalid;
  if (total <= 0) {
    return 0;
  }
  return valid / total;
};

/**
 * Ranks reporters by descending accuracy. Ties preserve the input order
 * (stable), so callers can pre-sort by a secondary key. Returns a new array of
 * `{ userId, accuracy }`; the input is not mutated. Pure and deterministic.
 */
export const rankReporters = (
  reporters: readonly Reporter[],
): readonly RankedReporter[] =>
  reporters
    .map((r) => ({ userId: r.userId, accuracy: reporterAccuracy(r) }))
    .sort((a, b) => b.accuracy - a.accuracy);

/**
 * True when the reporter's accuracy is strictly below `threshold`, i.e. too
 * unreliable to trust. A reporter with no reports (accuracy 0) is unreliable
 * for any positive threshold. Pure and deterministic.
 */
export const isUnreliableReporter = (r: Reporter, threshold: number): boolean =>
  reporterAccuracy(r) < threshold;
