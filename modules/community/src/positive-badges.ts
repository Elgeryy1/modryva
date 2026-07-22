/**
 * A single reputation badge as stored internally. The `positive` flag marks
 * whether the badge is safe to show publicly. Negative badges are part of the
 * hidden history and must never be exposed by this module.
 * Pure and deterministic.
 */
export interface PositiveBadgeInput {
  readonly id: string;
  readonly positive: boolean;
}

/**
 * Selects the ids of positive badges only, preserving input order and never
 * leaking negative history. Returns an empty array when there are no positive
 * badges. Duplicates in the input are preserved as-is; the input is never
 * mutated (a fresh array is returned).
 * Pure and deterministic.
 */
export const selectPositiveBadges = (
  badges: readonly PositiveBadgeInput[],
): readonly string[] => {
  const ids: string[] = [];
  for (const badge of badges) {
    if (badge.positive) {
      ids.push(badge.id);
    }
  }
  return ids;
};
