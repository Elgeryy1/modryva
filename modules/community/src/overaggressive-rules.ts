/**
 * Stats for a single moderation rule: how many messages it blocked and how many
 * of those blocked messages were later judged legitimate (false positives).
 * Pure and deterministic.
 */
export interface RuleStats {
  readonly name: string;
  readonly blocked: number;
  readonly legit: number;
}

/**
 * Tuning options for overaggressive-rule detection. Both fields are optional and
 * fall back to sensible defaults (minBlocked=5, maxLegitRatio=0.5).
 * Pure and deterministic.
 */
export interface OveraggressiveOptions {
  readonly minBlocked?: number;
  readonly maxLegitRatio?: number;
}

/**
 * A rule flagged as overaggressive, with its legit-to-blocked ratio.
 * Pure and deterministic.
 */
export interface OveraggressiveRule {
  readonly name: string;
  readonly legitRatio: number;
}

const DEFAULT_MIN_BLOCKED = 5;
const DEFAULT_MAX_LEGIT_RATIO = 0.5;

/**
 * Rounds a number to 2 decimal places. Pure and deterministic.
 */
const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Detects moderation rules that are too aggressive: rules that blocked enough
 * messages (blocked >= minBlocked) while a large share of those blocks were
 * legitimate content (legitRatio >= maxLegitRatio). legitRatio is legit/blocked
 * rounded to 2 decimals; rules with non-positive blocked counts are skipped.
 * Results are sorted by legitRatio descending, ties broken by name ascending.
 * Pure and deterministic.
 */
export const detectOveraggressiveRules = (
  rules: readonly RuleStats[],
  options?: OveraggressiveOptions,
): readonly OveraggressiveRule[] => {
  const minBlocked = options?.minBlocked ?? DEFAULT_MIN_BLOCKED;
  const maxLegitRatio = options?.maxLegitRatio ?? DEFAULT_MAX_LEGIT_RATIO;

  const flagged: OveraggressiveRule[] = [];
  for (const rule of rules) {
    if (rule.blocked <= 0 || rule.blocked < minBlocked) {
      continue;
    }
    const legitRatio = round2(rule.legit / rule.blocked);
    if (legitRatio >= maxLegitRatio) {
      flagged.push({ name: rule.name, legitRatio });
    }
  }

  return flagged.sort((a, b) => {
    if (b.legitRatio !== a.legitRatio) {
      return b.legitRatio - a.legitRatio;
    }
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
};
