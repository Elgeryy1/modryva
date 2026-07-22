/**
 * Input for the mention shield: how many times a target user has been
 * mentioned inside the current protection window.
 * Pure and deterministic.
 */
export interface MentionShieldInput {
  /** Number of mentions aimed at the protected user in the window. */
  readonly mentionsInWindow: number;
}

/**
 * Tuning options for the mention shield. Omitting a field uses its default.
 * Pure and deterministic.
 */
export interface MentionShieldOptions {
  /** Allowed mentions before shielding kicks in. Default 5. */
  readonly maxMentions?: number;
}

/**
 * Outcome of evaluating the mention shield for a target user.
 * Pure and deterministic.
 */
export interface MentionShieldResult {
  /** True when the mention count exceeds the allowed maximum. */
  readonly limited: boolean;
  /** How many mentions went over the allowed maximum (never negative). */
  readonly excess: number;
}

const DEFAULT_MAX_MENTIONS = 5;

/**
 * Coerces a raw numeric input into a safe, non-negative integer count.
 * Non-finite or negative values collapse to 0.
 */
const toSafeCount = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
};

/**
 * Protects a user under attack by limiting mentions aimed at them within a
 * window. Reports whether the mention count crossed the allowed maximum and
 * by how much. Counts are clamped to non-negative integers and maxMentions
 * defaults to 5. Pure and deterministic.
 */
export const shieldFromMentions = (
  input: MentionShieldInput,
  options?: MentionShieldOptions,
): MentionShieldResult => {
  const mentions = toSafeCount(input.mentionsInWindow);
  const rawMax = options?.maxMentions;
  const maxMentions =
    rawMax !== undefined ? toSafeCount(rawMax) : DEFAULT_MAX_MENTIONS;
  const excess = mentions > maxMentions ? mentions - maxMentions : 0;
  return { limited: excess > 0, excess };
};
