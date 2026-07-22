/**
 * Numeric activity snapshot for a single staff member: how many conflicts
 * they have resolved and for how many hours they have been active.
 * Pure and deterministic.
 */
export interface BurnoutInput {
  readonly conflictsResolved: number;
  readonly hoursActive: number;
}

/**
 * Optional thresholds tuning burnout detection. `maxPerHour` is the resolution
 * rate (per hour) at or above which we consider the pace risky (default 10).
 * `minHours` is the minimum active hours before the rate is trusted (default 3).
 * Pure and deterministic.
 */
export interface BurnoutOptions {
  readonly maxPerHour?: number;
  readonly minHours?: number;
}

/**
 * Result of a burnout check: whether the staff member is at risk, their
 * resolution rate per hour (rounded to 2 decimals), and user-facing advice.
 * Pure and deterministic.
 */
export interface BurnoutResult {
  readonly burnout: boolean;
  readonly ratePerHour: number;
  readonly advice: string;
}

const DEFAULT_MAX_PER_HOUR = 10;
const DEFAULT_MIN_HOURS = 3;

/**
 * Rounds a number to 2 decimal places using standard half-up rounding.
 * Pure and deterministic.
 */
const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Detects staff burnout from an activity snapshot: if an admin resolves too
 * much conflict too fast (rate at or above `maxPerHour`) after being active
 * for at least `minHours`, it flags burnout and suggests taking a break.
 * A non-positive `hoursActive` yields a rate of 0 and no burnout.
 * Pure and deterministic.
 */
export const detectBurnout = (
  input: BurnoutInput,
  options?: BurnoutOptions,
): BurnoutResult => {
  const maxPerHour = options?.maxPerHour ?? DEFAULT_MAX_PER_HOUR;
  const minHours = options?.minHours ?? DEFAULT_MIN_HOURS;

  const conflictsResolved = input.conflictsResolved;
  const hoursActive = input.hoursActive;

  const ratePerHour =
    hoursActive > 0 ? round2(conflictsResolved / hoursActive) : 0;

  const burnout = hoursActive >= minHours && ratePerHour >= maxPerHour;

  const advice = burnout
    ? `⚠️ Has resuelto ${conflictsResolved} conflictos en ${hoursActive} h (${ratePerHour}/h). Vas a un ritmo muy alto, tómate un descanso. 🌿`
    : "✅ Ritmo de moderación saludable. Sigue así y no olvides descansar. 💧";

  return { burnout, ratePerHour, advice };
};
