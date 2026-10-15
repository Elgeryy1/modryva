/**
 * A message candidate for the soft-cleanup review. Only the fields needed to
 * decide whether it is stale spam are modelled here.
 * Pure and deterministic.
 */
export interface SoftCleanupMessage {
  /** Stable identifier of the message (returned verbatim when suggested). */
  readonly id: string;
  /** Whether moderation already flagged this message as spam. */
  readonly isSpam: boolean;
  /** How old the message is, in milliseconds. */
  readonly ageMs: number;
}

/**
 * Tuning knobs for the soft-cleanup suggestion pass.
 * Pure and deterministic.
 */
export interface SoftCleanupOptions {
  /** Minimum age (ms) a spam message must EXCEED to be suggested. Defaults to 24h. */
  readonly minAgeMs?: number;
}

/** 24 hours expressed in milliseconds, used as the default staleness threshold. */
const DEFAULT_MIN_AGE_MS = 86_400_000;

/**
 * Suggests, but never performs, deletion of stale spam. Returns the ids of
 * messages that are BOTH flagged as spam AND strictly older than minAgeMs,
 * preserving the input order. This is a "soft" cleanup: it proposes candidates
 * for an admin to confirm instead of deleting blindly. The nowMs parameter is
 * accepted for signature stability but unused, because ageMs is already
 * relative. Returns an empty list for empty input.
 * Pure and deterministic.
 */
export const suggestSoftCleanup = (
  messages: readonly SoftCleanupMessage[],
  _nowMsUnused?: number,
  options?: SoftCleanupOptions,
): readonly string[] => {
  const minAgeMs = options?.minAgeMs ?? DEFAULT_MIN_AGE_MS;
  const ids: string[] = [];
  for (const message of messages) {
    if (message.isSpam && message.ageMs > minAgeMs) {
      ids.push(message.id);
    }
  }
  return ids;
};
