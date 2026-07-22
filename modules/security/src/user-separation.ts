/**
 * Options for a temporal user-separation window.
 *
 * Models the "separacion temporal" rule: after a conflict between two users
 * they may keep talking in the group but must not reply to each other for a
 * number of hours. Pure and deterministic.
 */
export interface UserSeparationOptions {
  /** How many hours the separation lasts. Defaults to 12. Non-positive means no window. */
  readonly hours?: number;
}

/** Milliseconds in one hour. Pure and deterministic. */
const MS_PER_HOUR = 3_600_000;

/** Default separation duration in hours when none is supplied. Pure and deterministic. */
const DEFAULT_SEPARATION_HOURS = 12;

/**
 * Resolves the effective separation duration in hours from the options,
 * clamping any non-positive or non-finite value to zero. Internal helper.
 * Pure and deterministic.
 */
const resolveHours = (options?: UserSeparationOptions): number => {
  const raw = options?.hours ?? DEFAULT_SEPARATION_HOURS;
  if (!Number.isFinite(raw) || raw <= 0) {
    return 0;
  }
  return raw;
};

/**
 * Computes the epoch millisecond timestamp at which the separation window ends,
 * given the conflict time and an optional duration (default 12 hours).
 * The result equals conflictMs when the duration is non-positive. Pure and deterministic.
 */
export const computeSeparationUntilMs = (
  conflictMs: number,
  options?: UserSeparationOptions,
): number => conflictMs + resolveHours(options) * MS_PER_HOUR;

/**
 * Returns true when the separation window is still active at nowMs, i.e. the
 * two users must not reply to each other yet. The boundary instant (nowMs equal
 * to the end) is treated as already expired. Pure and deterministic.
 */
export const isSeparationActive = (
  conflictMs: number,
  nowMs: number,
  options?: UserSeparationOptions,
): boolean => nowMs < computeSeparationUntilMs(conflictMs, options);

/**
 * Returns the remaining milliseconds of separation at nowMs, never negative.
 * Yields zero once the window has ended or when the duration is non-positive.
 * Pure and deterministic.
 */
export const separationRemainingMs = (
  conflictMs: number,
  nowMs: number,
  options?: UserSeparationOptions,
): number => {
  const remaining = computeSeparationUntilMs(conflictMs, options) - nowMs;
  return remaining > 0 ? remaining : 0;
};
