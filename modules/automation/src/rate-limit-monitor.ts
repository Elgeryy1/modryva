/**
 * Result of inspecting recent call activity against a rate limit.
 * Pure and deterministic.
 */
export interface RateLimitStatus {
  /** Number of calls whose timestamp falls inside the sliding window. */
  readonly countInWindow: number;
  /** True when the count has reached the warning threshold (limit * warnRatio). */
  readonly near: boolean;
  /** True when the count has reached or exceeded the hard limit. */
  readonly over: boolean;
}

/**
 * Tuning options for detectRateLimitApproach.
 * All fields are optional and fall back to sensible defaults.
 * Pure and deterministic.
 */
export interface RateLimitOptions {
  /** Sliding window length in milliseconds. Default 1000. */
  readonly windowMs?: number;
  /** Hard call limit inside the window. Default 30. */
  readonly limit?: number;
  /** Fraction of the limit that triggers the warning. Default 0.8. */
  readonly warnRatio?: number;
}

const DEFAULT_WINDOW_MS = 1000;
const DEFAULT_LIMIT = 30;
const DEFAULT_WARN_RATIO = 0.8;

/**
 * Counts how many call timestamps fall inside the half-open window
 * (nowMs - windowMs, nowMs] and reports whether the caller is near or over
 * the configured rate limit. Timestamps at exactly nowMs - windowMs are
 * excluded; timestamps at exactly nowMs are included. Order of the input
 * array does not affect the result.
 * Pure and deterministic.
 */
export const detectRateLimitApproach = (
  callTimestampsMs: readonly number[],
  nowMs: number,
  options?: RateLimitOptions,
): RateLimitStatus => {
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const warnRatio = options?.warnRatio ?? DEFAULT_WARN_RATIO;

  const lowerBound = nowMs - windowMs;
  let countInWindow = 0;
  for (const ts of callTimestampsMs) {
    if (ts > lowerBound && ts <= nowMs) {
      countInWindow += 1;
    }
  }

  const warnThreshold = limit * warnRatio;
  return {
    countInWindow,
    near: countInWindow >= warnThreshold,
    over: countInWindow >= limit,
  };
};
