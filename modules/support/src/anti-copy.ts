/**
 * Result of scanning a message for shameless answer-begging.
 * `matched` is true when at least one begging phrase was found.
 * `phrases` lists the canonical detected phrases in BEGGING_PHRASES order.
 * Pure and deterministic.
 */
export interface AnswerBeggingSignal {
  readonly matched: boolean;
  readonly phrases: readonly string[];
}

/**
 * Canonical begging phrases, stored as plain ASCII lowercase and matched
 * accent- and case-insensitively against normalized input text.
 * Pure and deterministic.
 */
const BEGGING_PHRASES: readonly string[] = [
  "pasame las respuestas",
  "alguien tiene el examen",
  "me lo haces",
  "respuestas del test",
];

/**
 * Normalizes text for accent- and case-insensitive matching: lowercases,
 * strips combining diacritics, collapses whitespace runs to single spaces
 * and trims the ends.
 * Pure and deterministic.
 */
const normalize = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Detects messages that shamelessly beg for answers without effort, such as
 * asking someone to hand over exam answers or to do the work for them.
 * Matching is case- and accent-insensitive, deduplicated, and preserves the
 * BEGGING_PHRASES order. Returns an empty, unmatched result for undefined or
 * clean text.
 * Pure and deterministic.
 */
export const detectAnswerBegging = (
  text: string | undefined,
): AnswerBeggingSignal => {
  if (!text) {
    return { matched: false, phrases: [] };
  }
  const haystack = normalize(text);
  const phrases: string[] = [];
  for (const phrase of BEGGING_PHRASES) {
    if (haystack.includes(phrase) && !phrases.includes(phrase)) {
      phrases.push(phrase);
    }
  }
  return { matched: phrases.length > 0, phrases };
};
