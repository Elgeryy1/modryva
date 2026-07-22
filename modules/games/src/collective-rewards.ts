/**
 * Input for a collective-reward evaluation: how much the group improved
 * over the previous measurement period, in arbitrary progress points.
 * Pure and deterministic.
 */
export interface CollectiveRewardInput {
  readonly improvement: number;
}

/**
 * Tunables for computeCollectiveReward. threshold is the minimum improvement
 * that unlocks the reward (default 10); reward is the shared payout granted to
 * every member when unlocked (default 50). Invalid or negative values fall back
 * to their defaults. Pure and deterministic.
 */
export interface CollectiveRewardOptions {
  readonly threshold?: number;
  readonly reward?: number;
}

/**
 * Outcome of a collective-reward evaluation. earned is true when the group met
 * the threshold; rewardPerMember is the payout each member receives (0 when not
 * earned); message is a Spanish, user-facing announcement. Pure and
 * deterministic.
 */
export interface CollectiveRewardOutcome {
  readonly earned: boolean;
  readonly rewardPerMember: number;
  readonly message: string;
}

const DEFAULT_THRESHOLD = 10;
const DEFAULT_REWARD = 50;

/**
 * Resolves an optional numeric tunable, using the fallback when the value is
 * missing, non-finite, or negative. Pure and deterministic.
 */
const resolveTunable = (
  value: number | undefined,
  fallback: number,
): number => {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return value;
};

/**
 * Evaluates a shared, group-wide reward: when the group's improvement reaches
 * the threshold, every member receives the same reward instead of individuals
 * being singled out. Non-finite improvement is treated as 0 (no progress).
 * Boundary is inclusive: improvement equal to the threshold earns the reward.
 * Pure and deterministic.
 */
export const computeCollectiveReward = (
  input: CollectiveRewardInput,
  options?: CollectiveRewardOptions,
): CollectiveRewardOutcome => {
  const threshold = resolveTunable(options?.threshold, DEFAULT_THRESHOLD);
  const reward = resolveTunable(options?.reward, DEFAULT_REWARD);
  const improvement = Number.isFinite(input.improvement)
    ? input.improvement
    : 0;

  const earned = improvement >= threshold;
  const rewardPerMember = earned ? reward : 0;
  const message = earned
    ? `¡El grupo mejoró! Todos reciben ${rewardPerMember} fichas 🎉`
    : "El grupo aún no alcanza la meta. ¡Sigan mejorando juntos! 💪";

  return { earned, rewardPerMember, message };
};
