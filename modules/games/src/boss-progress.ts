/**
 * Input for the weekly boss progress calculation. `done` is the aggregated
 * community effort so far and `goal` is the shared weekly target.
 * Pure and deterministic.
 */
export interface BossProgressInput {
  readonly done: number;
  readonly goal: number;
}

/**
 * Result describing how close the community is to defeating the weekly boss.
 * `percent` is an integer 0..100, `defeated` is true once `done` reaches the
 * goal, and `remaining` is how much effort is still missing (never negative).
 * Pure and deterministic.
 */
export interface BossProgress {
  readonly percent: number;
  readonly defeated: boolean;
  readonly remaining: number;
}

/**
 * Clamps a number into the inclusive [min, max] range.
 * Pure and deterministic.
 */
const clampRange = (value: number, min: number, max: number): number => {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};

/**
 * Computes progress toward the weekly community boss goal. `percent` is the
 * rounded ratio done/goal, clamped to 0..100 (a goal of zero or less yields 0
 * to avoid division issues). `defeated` is true when `done` meets or exceeds
 * the goal. `remaining` is the non-negative effort still needed.
 * Pure and deterministic.
 */
export const computeBossProgress = (input: BossProgressInput): BossProgress => {
  const { done, goal } = input;
  const rawPercent = goal <= 0 ? 0 : Math.round((done / goal) * 100);
  const percent = clampRange(rawPercent, 0, 100);
  const defeated = done >= goal;
  const remaining = Math.max(0, goal - done);
  return { percent, defeated, remaining };
};
