/** Options for detectAppealSpam. */
export interface AppealSpamOptions {
  readonly windowMs?: number;
  readonly maxInWindow?: number;
}

/**
 * Result of an appeal-spam check: whether further appeals are blocked and how
 * many fall inside the window. Pure and deterministic.
 */
export interface AppealSpamResult {
  readonly blocked: boolean;
  readonly countInWindow: number;
}

const DEFAULT_APPEAL_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_APPEAL_MAX = 3;

/**
 * Detects repeated-appeal spam: counts appeal timestamps within the trailing
 * window [nowMs - windowMs, nowMs] (defaults 24h) and blocks once they reach
 * maxInWindow (default 3). Pure and deterministic.
 */
export const detectAppealSpam = (
  appealTimestampsMs: readonly number[],
  nowMs: number,
  options?: AppealSpamOptions,
): AppealSpamResult => {
  const windowMs = options?.windowMs ?? DEFAULT_APPEAL_WINDOW_MS;
  const maxInWindow = options?.maxInWindow ?? DEFAULT_APPEAL_MAX;
  const from = nowMs - windowMs;
  let countInWindow = 0;
  for (const timestamp of appealTimestampsMs) {
    if (timestamp >= from && timestamp <= nowMs) {
      countInWindow += 1;
    }
  }
  return { blocked: countInWindow >= maxInWindow, countInWindow };
};
