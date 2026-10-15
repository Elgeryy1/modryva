/**
 * A guess about a group statistic versus its real value. Pure and
 * deterministic.
 */
export interface StatGuessInput {
  readonly guess: number;
  readonly actual: number;
}

/** Options for scoreStatGuess. */
export interface StatGuessOptions {
  readonly tolerancePct?: number;
}

/**
 * Scoring for a stat guess: whether it counts as correct, the absolute error
 * and the points awarded. Pure and deterministic.
 */
export interface StatGuessScore {
  readonly correct: boolean;
  readonly offBy: number;
  readonly points: number;
}

const DEFAULT_TOLERANCE_PCT = 10;

/**
 * Scores a "guess the group stat" answer. A guess is correct when its absolute
 * error is within tolerancePct percent of the actual value (default 10%).
 * Correct guesses earn max(1, round(10 - errorPct)) points; wrong guesses earn
 * 0. When actual is 0 only an exact 0 guess is correct (full points).
 * Pure and deterministic.
 */
export const scoreStatGuess = (
  input: StatGuessInput,
  options?: StatGuessOptions,
): StatGuessScore => {
  const tolerancePct = options?.tolerancePct ?? DEFAULT_TOLERANCE_PCT;
  const offBy = Math.abs(input.guess - input.actual);
  if (input.actual === 0) {
    const correct = offBy === 0;
    return { correct, offBy, points: correct ? 10 : 0 };
  }
  const offByPct = (offBy / Math.abs(input.actual)) * 100;
  const correct = offByPct <= tolerancePct;
  const points = correct ? Math.max(1, Math.round(10 - offByPct)) : 0;
  return { correct, offBy, points };
};
