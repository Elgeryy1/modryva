/**
 * Aggregated activity counters for a single user in a group, used to spot
 * "silent spammers": accounts that talk very little yet nearly every message
 * they send carries a link or a mention.
 * Pure and deterministic.
 */
export interface SilentSpamInput {
  /** Total number of messages the user has sent in the window. */
  readonly messageCount: number;
  /** Number of those messages that contained at least one link. */
  readonly linkCount: number;
  /** Number of those messages that contained at least one mention. */
  readonly mentionCount: number;
}

/**
 * Tuning knobs for the silent-spam heuristic. Both fields are optional and
 * fall back to conservative defaults (maxMessages 10, minRatio 0.7).
 * Pure and deterministic.
 */
export interface SilentSpamOptions {
  /** Upper bound of messages to still be considered "low activity". */
  readonly maxMessages?: number;
  /** Minimum link+mention ratio to flag the user. */
  readonly minRatio?: number;
}

/**
 * Result of evaluating the silent-spam heuristic. `ratio` is the share of
 * link/mention signals per message, rounded to 2 decimals.
 * Pure and deterministic.
 */
export interface SilentSpamResult {
  /** Whether the user looks like a low-activity link/mention spammer. */
  readonly suspicious: boolean;
  /** (linkCount + mentionCount) / messageCount, rounded to 2 decimals. */
  readonly ratio: number;
}

const DEFAULT_MAX_MESSAGES = 10;
const DEFAULT_MIN_RATIO = 0.7;

/** Rounds a number to 2 decimal places. Pure and deterministic. */
const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Detects "silent spam": users who send few messages but where almost every
 * message contains a link or a mention. Returns the link+mention ratio (2
 * decimals) and whether the user is suspicious. A user is suspicious when
 * their messageCount is at or below maxMessages (default 10) AND the ratio is
 * at or above minRatio (default 0.7). When messageCount is 0 or negative the
 * ratio is 0 and the user is never flagged.
 * Pure and deterministic.
 */
export const detectSilentSpam = (
  input: SilentSpamInput,
  options?: SilentSpamOptions,
): SilentSpamResult => {
  const maxMessages = options?.maxMessages ?? DEFAULT_MAX_MESSAGES;
  const minRatio = options?.minRatio ?? DEFAULT_MIN_RATIO;

  if (input.messageCount <= 0) {
    return { suspicious: false, ratio: 0 };
  }

  const signals = input.linkCount + input.mentionCount;
  const ratio = round2(signals / input.messageCount);
  const suspicious = input.messageCount <= maxMessages && ratio >= minRatio;

  return { suspicious, ratio };
};
