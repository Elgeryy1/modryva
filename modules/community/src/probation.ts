/**
 * Probation window after an accepted appeal: a user returns to the group but
 * under a temporary trust period with limited privileges. All computations are
 * expressed in epoch milliseconds and never read the ambient clock.
 */

/** Default probation span: 7 days expressed in milliseconds. Pure and deterministic. */
const DEFAULT_PROBATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Optional tuning for a probation window. When probationMs is omitted, invalid
 * (non-finite) or negative, the default 7-day span is used. Pure and deterministic.
 */
export interface ProbationConfig {
  readonly probationMs?: number;
}

/**
 * A resolved probation window with inclusive start and exclusive end, both in
 * epoch milliseconds. Pure and deterministic.
 */
export interface ProbationWindow {
  readonly startMs: number;
  readonly untilMs: number;
}

/**
 * Resolves the effective probation span, falling back to the default for
 * omitted, non-finite or negative values. Pure and deterministic.
 */
const resolveProbationMs = (options?: ProbationConfig): number => {
  const raw = options?.probationMs;
  if (raw === undefined || !Number.isFinite(raw) || raw < 0) {
    return DEFAULT_PROBATION_MS;
  }
  return raw;
};

/**
 * Computes the probation window that starts when an appeal is accepted.
 * The window is [startMs, untilMs), i.e. it begins at acceptedMs and ends
 * (exclusive) after the resolved span. Pure and deterministic.
 */
export const computeProbation = (
  acceptedMs: number,
  options?: ProbationConfig,
): ProbationWindow => {
  const span = resolveProbationMs(options);
  return { startMs: acceptedMs, untilMs: acceptedMs + span };
};

/**
 * Returns true when nowMs falls inside the probation window, treating the start
 * as inclusive and the end as exclusive. Times before acceptedMs are not on
 * probation yet. Pure and deterministic.
 */
export const isOnProbation = (
  acceptedMs: number,
  nowMs: number,
  options?: ProbationConfig,
): boolean => {
  const { startMs, untilMs } = computeProbation(acceptedMs, options);
  return nowMs >= startMs && nowMs < untilMs;
};

/**
 * Returns the milliseconds remaining until probation ends, clamped to the range
 * [0, span]. Returns 0 once the window has elapsed and the full span before it
 * starts. Pure and deterministic.
 */
export const probationRemainingMs = (
  acceptedMs: number,
  nowMs: number,
  options?: ProbationConfig,
): number => {
  const span = resolveProbationMs(options);
  const { untilMs } = computeProbation(acceptedMs, options);
  const remaining = untilMs - nowMs;
  if (remaining <= 0) {
    return 0;
  }
  if (remaining > span) {
    return span;
  }
  return remaining;
};
