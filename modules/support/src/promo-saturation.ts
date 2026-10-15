/**
 * Options for {@link checkPromoSaturation}. Every field is optional and falls
 * back to a default (24h rolling window, at most 2 promos inside it).
 * Pure and deterministic.
 */
export interface PromoSaturationOptions {
  /** Rolling window length in milliseconds. Defaults to 24 hours. */
  readonly windowMs?: number;
  /** Maximum promos allowed inside the window before saturation. Defaults to 2. */
  readonly maxInWindow?: number;
}

/**
 * Result of a saturation check: whether the user is saturated and how many
 * shown timestamps fall inside the rolling window ending at nowMs.
 * Pure and deterministic.
 */
export interface PromoSaturationResult {
  /** True when countInWindow reaches or exceeds maxInWindow. */
  readonly saturated: boolean;
  /** Number of shown timestamps inside the rolling window ending at nowMs. */
  readonly countInWindow: number;
}

/** Default rolling window: 24 hours expressed in milliseconds. */
const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Default maximum number of promos tolerated inside the window. */
const DEFAULT_MAX_IN_WINDOW = 2;

/**
 * Decides whether a user has already seen too many promos recently, so the bot
 * can avoid spamming the same person. Counts how many entries of shownMs fall
 * inside the half-open rolling window (nowMs - windowMs, nowMs] and compares
 * that count against maxInWindow. Timestamps exactly windowMs old have expired
 * and are excluded; future timestamps (greater than nowMs) are ignored. The
 * order of shownMs never affects the result. Pure and deterministic.
 */
export const checkPromoSaturation = (
  shownMs: readonly number[],
  nowMs: number,
  options?: PromoSaturationOptions,
): PromoSaturationResult => {
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const maxInWindow = options?.maxInWindow ?? DEFAULT_MAX_IN_WINDOW;
  const threshold = nowMs - windowMs;
  let countInWindow = 0;
  for (const shown of shownMs) {
    if (shown > threshold && shown <= nowMs) {
      countInWindow += 1;
    }
  }
  return { saturated: countInWindow >= maxInWindow, countInWindow };
};
