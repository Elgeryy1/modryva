/**
 * Tuning knobs for the last-straw detector. Both fields are optional and fall
 * back to sensible defaults when omitted.
 * Pure and deterministic.
 */
export interface LastStrawOptions {
  /** Minimum accumulated friction that marks a user as at risk. Defaults to 10. */
  readonly threshold?: number;
  /** Minimum number of observed days before a verdict can be at risk. Defaults to 3. */
  readonly minDays?: number;
}

/**
 * Verdict describing how close a user is to "the last straw": total accumulated
 * friction, whether the trend is climbing, and whether they are at risk.
 * Pure and deterministic.
 */
export interface LastStrawAssessment {
  /** True when there are enough days AND accumulated friction reaches the threshold. */
  readonly atRisk: boolean;
  /** Sum of every daily friction value. */
  readonly accumulated: number;
  /** True when the most recent day is strictly higher than the day before it. */
  readonly trendingUp: boolean;
}

const DEFAULT_THRESHOLD = 10;
const DEFAULT_MIN_DAYS = 3;

/**
 * Detects the "last straw" pattern: users who have been accumulating friction
 * over time and are close to boiling over. Sums the daily friction, checks
 * whether the latest day is strictly worse than the previous one, and flags the
 * user as at risk once enough days have passed and the accumulated friction
 * meets the threshold. An empty series is never at risk and never trending up.
 * Pure and deterministic.
 */
export const detectLastStraw = (
  frictionByDay: readonly number[],
  options?: LastStrawOptions,
): LastStrawAssessment => {
  const threshold = options?.threshold ?? DEFAULT_THRESHOLD;
  const minDays = options?.minDays ?? DEFAULT_MIN_DAYS;

  let accumulated = 0;
  for (const value of frictionByDay) {
    accumulated += value;
  }

  let trendingUp = false;
  if (frictionByDay.length >= 2) {
    const last = frictionByDay[frictionByDay.length - 1] ?? 0;
    const prev = frictionByDay[frictionByDay.length - 2] ?? 0;
    trendingUp = last > prev;
  }

  const atRisk = frictionByDay.length >= minDays && accumulated >= threshold;

  return { atRisk, accumulated, trendingUp };
};
