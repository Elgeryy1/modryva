/**
 * A single chat message reduced to the fields needed to spot a circular
 * argument: who wrote it and the raw text. Plain readonly data, no behavior.
 */
export interface ConversationMessage {
  /** Stable identifier of the message author. */
  readonly authorId: number;
  /** Raw message text as typed by the author. */
  readonly text: string;
}

/**
 * Tuning options for detectCircularArgument.
 */
export interface CircularArgumentOptions {
  /**
   * Minimum number of near-duplicate repeats each author must reach for the
   * exchange to count as circular. Values below 1 are clamped to 1.
   * Defaults to 2.
   */
  readonly minRepeats?: number;
}

/**
 * Outcome of a circular-argument scan.
 */
export interface CircularArgumentResult {
  /** True when exactly two authors each repeated themselves enough. */
  readonly circular: boolean;
  /**
   * The two author ids locked in the loop, sorted ascending. Empty when the
   * exchange is not circular.
   */
  readonly authors: readonly number[];
  /**
   * How many times the loop went around: the smaller of the two authors'
   * top repeat counts. Zero when there are not exactly two authors.
   */
  readonly repeats: number;
}

/** Default per-author repeat threshold for calling an exchange circular. */
const DEFAULT_MIN_REPEATS = 2;

/**
 * Normalizes text for near-duplicate comparison: lowercased, punctuation and
 * symbols stripped, internal whitespace collapsed, then trimmed. Accented
 * letters are preserved. Pure and deterministic.
 */
const normalize = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Highest number of times a single author repeated the same normalized text.
 * Empty normalized texts are ignored. Pure and deterministic.
 */
const maxRepeatFor = (
  messages: readonly ConversationMessage[],
  authorId: number,
): number => {
  const counts = new Map<string, number>();
  let max = 0;
  for (const message of messages) {
    if (message.authorId !== authorId) {
      continue;
    }
    const key = normalize(message.text);
    if (key.length === 0) {
      continue;
    }
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    if (next > max) {
      max = next;
    }
  }
  return max;
};

/**
 * Detects a circular argument: two distinct authors ping-ponging the same
 * points. Returns circular=true only when the conversation has exactly two
 * authors and each repeats one of their own messages (compared after
 * normalization) at least minRepeats times. Interleaving order does not
 * matter; repeats counts per-author near-duplicates and reports the smaller
 * of the two top counts. Pure and deterministic.
 */
export const detectCircularArgument = (
  messages: readonly ConversationMessage[],
  options?: CircularArgumentOptions,
): CircularArgumentResult => {
  const minRepeats = Math.max(1, options?.minRepeats ?? DEFAULT_MIN_REPEATS);

  const authorOrder: number[] = [];
  for (const message of messages) {
    if (!authorOrder.includes(message.authorId)) {
      authorOrder.push(message.authorId);
    }
  }

  const firstAuthor = authorOrder[0];
  const secondAuthor = authorOrder[1];
  if (
    authorOrder.length !== 2 ||
    firstAuthor === undefined ||
    secondAuthor === undefined
  ) {
    return { circular: false, authors: [], repeats: 0 };
  }

  const firstRepeats = maxRepeatFor(messages, firstAuthor);
  const secondRepeats = maxRepeatFor(messages, secondAuthor);
  const repeats = Math.min(firstRepeats, secondRepeats);
  const circular = repeats >= minRepeats;
  const authors = circular
    ? [firstAuthor, secondAuthor].sort((left, right) => left - right)
    : [];

  return { circular, authors, repeats };
};
