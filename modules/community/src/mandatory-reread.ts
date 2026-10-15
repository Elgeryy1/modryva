/**
 * Rules-reread decision for the community module.
 *
 * When the group rules change substantially, members should be forced to
 * re-accept them. This module decides whether a fresh mandatory acceptance
 * is required based on how many rule lines were added, removed or edited.
 */

/**
 * Diff counts describing how the group rules changed since the last accepted
 * version. All counts are expected to be non-negative integers; negative or
 * fractional values are tolerated and simply summed.
 * Pure and deterministic.
 */
export interface MandatoryRereadInput {
  /** Number of rule lines added. */
  readonly added: number;
  /** Number of rule lines removed. */
  readonly removed: number;
  /** Number of rule lines edited in place. */
  readonly changed: number;
}

/**
 * Tuning options for the reread decision. When omitted, a change is
 * considered "big" once the total number of touched lines reaches 3.
 * Pure and deterministic.
 */
export interface MandatoryRereadOptions {
  /** Minimum total changes that trigger a mandatory reread (default 3). */
  readonly bigChangeThreshold?: number;
}

/**
 * Result of evaluating whether members must re-accept the rules.
 * Pure and deterministic.
 */
export interface MandatoryRereadDecision {
  /** True when the change is big enough to force re-acceptance. */
  readonly required: boolean;
  /** Sum of added, removed and changed lines. */
  readonly totalChanges: number;
}

const DEFAULT_BIG_CHANGE_THRESHOLD = 3;

/**
 * Decides whether members must re-accept the group rules after an edit.
 * totalChanges is added + removed + changed; a reread is required when
 * totalChanges is greater than or equal to bigChangeThreshold (default 3).
 * Pure and deterministic.
 */
export const decideMandatoryReread = (
  input: MandatoryRereadInput,
  options?: MandatoryRereadOptions,
): MandatoryRereadDecision => {
  const threshold = options?.bigChangeThreshold ?? DEFAULT_BIG_CHANGE_THRESHOLD;
  const totalChanges = input.added + input.removed + input.changed;
  return { required: totalChanges >= threshold, totalChanges };
};
