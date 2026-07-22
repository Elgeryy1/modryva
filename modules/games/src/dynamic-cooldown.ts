/**
 * Input for the dynamic cooldown calculation. The abuse score is an
 * intensity signal (higher means more detected abuse). It is floored and
 * clamped to the range [0, 6] before being used as the exponent.
 * Pure and deterministic.
 */
export interface DynamicCooldownInput {
  /** Detected abuse intensity. Floored and clamped to [0, 6]. */
  readonly abuseScore: number;
}

/**
 * Tuning options for the dynamic cooldown. Both bounds are optional and fall
 * back to sane defaults when omitted or when a non-finite/negative value is
 * supplied.
 * Pure and deterministic.
 */
export interface DynamicCooldownOptions {
  /** Cooldown floor in milliseconds when abuseScore is 0. Default 5000. */
  readonly baseMs?: number;
  /** Absolute cooldown ceiling in milliseconds. Default 300000. */
  readonly maxMs?: number;
}

/** Default cooldown floor in milliseconds. */
const DEFAULT_BASE_MS = 5000;
/** Default cooldown ceiling in milliseconds. */
const DEFAULT_MAX_MS = 300000;
/** Highest allowed abuse exponent, doubling the cooldown per step. */
const MAX_ABUSE_EXPONENT = 6;

/** Returns value when it is a finite number >= 0, otherwise the fallback. Pure and deterministic. */
const finiteOr = (value: number | undefined, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;

/** Floors then clamps the abuse score into [0, MAX_ABUSE_EXPONENT]. Pure and deterministic. */
const clampAbuse = (score: number): number => {
  if (!Number.isFinite(score)) {
    return 0;
  }
  const floored = Math.floor(score);
  if (floored < 0) {
    return 0;
  }
  if (floored > MAX_ABUSE_EXPONENT) {
    return MAX_ABUSE_EXPONENT;
  }
  return floored;
};

/**
 * Computes an exponentially growing cooldown in milliseconds from a detected
 * abuse score: cooldown = min(maxMs, baseMs * 2^clamp(floor(abuseScore), 0, 6)).
 * The abuse score is floored and clamped, so it never overflows the ceiling
 * unexpectedly, and the result is always an integer number of milliseconds
 * within [baseMs, maxMs]. Non-finite or negative options fall back to defaults.
 * Pure and deterministic.
 */
export const computeDynamicCooldownMs = (
  input: DynamicCooldownInput,
  options?: DynamicCooldownOptions,
): number => {
  const baseMs = finiteOr(options?.baseMs, DEFAULT_BASE_MS);
  const maxMs = finiteOr(options?.maxMs, DEFAULT_MAX_MS);
  const exponent = clampAbuse(input.abuseScore);
  const scaled = baseMs * 2 ** exponent;
  return Math.round(Math.min(maxMs, scaled));
};
