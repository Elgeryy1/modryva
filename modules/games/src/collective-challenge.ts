/**
 * One answer submitted by the group during a collective knowledge challenge.
 * Pure and deterministic.
 */
export interface CollectiveChallengeAnswer {
  /** Whether this answer was correct. */
  readonly correct: boolean;
}

/**
 * Tuning options for scoreCollectiveChallenge.
 * Pure and deterministic.
 */
export interface CollectiveChallengeOptions {
  /** Minimum correct ratio for the group to win. Defaults to 0.6. */
  readonly passRatio?: number;
}

/**
 * Result of scoring a collective knowledge challenge: raw counts, the correct
 * ratio rounded to two decimals, and whether the group beat the bot.
 * Pure and deterministic.
 */
export interface CollectiveChallengeScore {
  /** Number of correct answers. */
  readonly correct: number;
  /** Total number of answers submitted. */
  readonly total: number;
  /** correct / total, rounded to two decimals; 0 when there are no answers. */
  readonly ratio: number;
  /** True when ratio is greater than or equal to the pass ratio. */
  readonly won: boolean;
}

const DEFAULT_PASS_RATIO = 0.6;

/**
 * Rounds a value to two decimals using half-up rounding on the hundredths.
 * Internal helper, not exported.
 */
const roundToTwo = (value: number): number => Math.round(value * 100) / 100;

/**
 * Scores a group's collective knowledge challenge against the bot. Counts the
 * correct answers, computes the ratio rounded to two decimals, and marks the
 * group as winner when the ratio meets or exceeds passRatio (default 0.6). With
 * no answers the ratio is 0 and won is false. Pure and deterministic.
 */
export const scoreCollectiveChallenge = (
  answers: readonly CollectiveChallengeAnswer[],
  options?: CollectiveChallengeOptions,
): CollectiveChallengeScore => {
  const passRatio = options?.passRatio ?? DEFAULT_PASS_RATIO;
  const total = answers.length;
  let correct = 0;
  for (const answer of answers) {
    if (answer.correct) {
      correct += 1;
    }
  }
  if (total === 0) {
    return { correct: 0, total: 0, ratio: 0, won: false };
  }
  const ratio = roundToTwo(correct / total);
  return { correct, total, ratio, won: ratio >= passRatio };
};
