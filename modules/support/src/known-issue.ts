/**
 * Configuration for the known-issue auto-notice.
 * threshold: minimum number of complaints within the observation window
 * required to consider the issue a "spike" and emit the notice.
 * Pure and deterministic.
 */
export interface KnownIssueNoticeOptions {
  readonly threshold?: number;
}

/**
 * Result of evaluating a complaint spike.
 * active is true when the notice should be sent; message carries the
 * user-facing Spanish text (empty string when inactive).
 * Pure and deterministic.
 */
export interface KnownIssueNotice {
  readonly active: boolean;
  readonly message: string;
}

/** Default complaint count that triggers the notice. Pure and deterministic. */
const DEFAULT_KNOWN_ISSUE_THRESHOLD = 5;

/** User-facing Spanish notice shown when a complaint spike is detected. */
const KNOWN_ISSUE_MESSAGE =
  "🛠️ Ya estamos revisando esto. Gracias por avisarnos, un miembro del equipo lo está atendiendo.";

/** Coerces a value to a non-negative integer, falling back to 0. */
const toNonNegativeInt = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
};

/** Coerces a threshold to a positive integer, falling back to the default. */
const toThreshold = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_KNOWN_ISSUE_THRESHOLD;
  }
  return Math.trunc(value);
};

/**
 * Decides whether an automatic "ya estamos revisando esto" notice should be
 * emitted based on the number of complaints observed in the current window.
 * The notice is active when complaintsInWindow is greater than or equal to
 * the threshold (default 5). Negative or non-finite complaint counts are
 * treated as 0; non-positive or non-finite thresholds fall back to the
 * default. Fractional inputs are truncated toward zero.
 * Pure and deterministic.
 */
export const buildKnownIssueNotice = (
  complaintsInWindow: number,
  options?: KnownIssueNoticeOptions,
): KnownIssueNotice => {
  const complaints = toNonNegativeInt(complaintsInWindow);
  const threshold = toThreshold(
    options?.threshold ?? DEFAULT_KNOWN_ISSUE_THRESHOLD,
  );
  const active = complaints >= threshold;
  return { active, message: active ? KNOWN_ISSUE_MESSAGE : "" };
};
