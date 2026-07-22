/**
 * Inputs for a double-reputation event: the base points, whether the action was
 * useful, and whether the event is active. Pure and deterministic.
 */
export interface DoubleRepInput {
  readonly basePoints: number;
  readonly isUsefulAction: boolean;
  readonly eventActive: boolean;
}

/**
 * The awarded points and whether the doubling applied. Pure and deterministic.
 */
export interface DoubleRepResult {
  readonly points: number;
  readonly doubled: boolean;
}

/**
 * Applies a double-reputation event: points are doubled only when the event is
 * active AND the action was useful (not for mere activity). Otherwise the base
 * points stand. Pure and deterministic.
 */
export const applyDoubleRep = (input: DoubleRepInput): DoubleRepResult => {
  const doubled = input.eventActive && input.isUsefulAction;
  return {
    points: doubled ? input.basePoints * 2 : input.basePoints,
    doubled,
  };
};
