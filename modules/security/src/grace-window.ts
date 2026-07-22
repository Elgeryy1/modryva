/**
 * Default grace window in milliseconds: how long a user is allowed to edit or
 * delete an offending message before the bot applies a sanction. Thirty seconds.
 * Pure and deterministic.
 */
export const DEFAULT_GRACE_MS = 30000;

/**
 * Options that tune the grace window. Omit graceMs to use DEFAULT_GRACE_MS.
 * A non-finite or negative graceMs is ignored and falls back to the default.
 * Pure and deterministic.
 */
export interface GraceOptions {
  readonly graceMs?: number;
}

/**
 * Resolves the effective grace window from options, falling back to
 * DEFAULT_GRACE_MS when graceMs is missing, non-finite or negative.
 * Pure and deterministic.
 */
const resolveGraceMs = (options?: GraceOptions): number => {
  const raw = options?.graceMs;
  if (raw === undefined || !Number.isFinite(raw) || raw < 0) {
    return DEFAULT_GRACE_MS;
  }
  return raw;
};

/**
 * Computes the absolute timestamp (ms) at which the grace window closes for a
 * message sent at sentMs. After this deadline the bot may sanction.
 * Pure and deterministic.
 */
export const computeGraceDeadlineMs = (
  sentMs: number,
  options?: GraceOptions,
): number => sentMs + resolveGraceMs(options);

/**
 * Returns true while the message is still inside its grace window, i.e. the
 * user can still correct it. The deadline itself is exclusive: at exactly the
 * deadline the grace is over. Clock skew (nowMs < sentMs) counts as within.
 * Pure and deterministic.
 */
export const isWithinGrace = (
  sentMs: number,
  nowMs: number,
  options?: GraceOptions,
): boolean => nowMs < computeGraceDeadlineMs(sentMs, options);

/**
 * Returns the remaining grace time in milliseconds, clamped to zero once the
 * window has closed. Useful to render a countdown before sanctioning.
 * Pure and deterministic.
 */
export const graceRemainingMs = (
  sentMs: number,
  nowMs: number,
  options?: GraceOptions,
): number => {
  const remaining = computeGraceDeadlineMs(sentMs, options) - nowMs;
  return remaining > 0 ? remaining : 0;
};
