/**
 * Result of evaluating an anti-toxicity challenge: whether a streak of days
 * without sanctions has reached the target and earned the global reward.
 * Pure and deterministic.
 */
export interface AntiToxicityRewardOutcome {
  /** True when the sanction-free streak reached the target. */
  readonly earned: boolean;
  /** Reward amount granted (0 until earned). */
  readonly reward: number;
  /** Sanction-free days still missing to earn the reward (0 once earned). */
  readonly daysRemaining: number;
  /** User-facing Spanish summary of the current challenge state. */
  readonly message: string;
}

/** Default target: a full week (7 days) without sanctions. */
const DEFAULT_TARGET_DAYS = 7;

/** Default global reward granted when the challenge is completed. */
const DEFAULT_REWARD = 100;

/**
 * Coerces a raw day count into a non-negative integer, flooring fractions and
 * mapping non-finite or negative inputs to 0.
 * Pure and deterministic.
 */
const toNonNegativeDays = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const floored = Math.floor(value);
  return floored < 0 ? 0 : floored;
};

/**
 * Coerces a target-days option into a positive integer, falling back to the
 * default when missing, non-finite, or not strictly positive.
 * Pure and deterministic.
 */
const toPositiveTarget = (
  value: number | undefined,
  fallback: number,
): number => {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  const floored = Math.floor(value);
  return floored > 0 ? floored : fallback;
};

/**
 * Coerces a reward option into a non-negative integer, falling back to the
 * default when missing or non-finite. Zero is allowed.
 * Pure and deterministic.
 */
const toNonNegativeReward = (
  value: number | undefined,
  fallback: number,
): number => {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  const floored = Math.floor(value);
  return floored < 0 ? 0 : floored;
};

/**
 * Returns the correct Spanish word for a day count (singular vs plural).
 * Pure and deterministic.
 */
const dayWord = (count: number): string => (count === 1 ? "día" : "días");

/**
 * Evaluates an anti-toxicity challenge where a community earns a global reward
 * after a streak of days without sanctions. targetDays defaults to 7 and reward
 * defaults to 100. The reward is granted only when daysWithoutSanction reaches
 * the target; otherwise it is 0 and daysRemaining reports the gap. Invalid or
 * negative inputs are sanitized (days floored to a non-negative integer, an
 * invalid target falls back to 7, an invalid reward falls back to 100).
 * Pure and deterministic.
 */
export const computeAntiToxicityReward = (
  daysWithoutSanction: number,
  options?: { readonly targetDays?: number; readonly reward?: number },
): AntiToxicityRewardOutcome => {
  const targetDays = toPositiveTarget(options?.targetDays, DEFAULT_TARGET_DAYS);
  const rewardAmount = toNonNegativeReward(options?.reward, DEFAULT_REWARD);
  const days = toNonNegativeDays(daysWithoutSanction);
  const earned = days >= targetDays;
  const daysRemaining = earned ? 0 : targetDays - days;
  const reward = earned ? rewardAmount : 0;
  const verb = daysRemaining === 1 ? "falta" : "faltan";
  const message = earned
    ? `🎉 ¡Reto anti-toxicidad superado! ${targetDays} ${dayWord(targetDays)} sin sanciones: recompensa global de ${rewardAmount} fichas. 🛡️`
    : `💪 Reto anti-toxicidad en curso: ${verb} ${daysRemaining} ${dayWord(daysRemaining)} sin sanciones para la recompensa global.`;
  return { earned, reward, daysRemaining, message };
};
