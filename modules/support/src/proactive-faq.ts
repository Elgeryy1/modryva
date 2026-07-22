/**
 * A single frequently-asked-question entry with its canned answer.
 * Pure data shape used as input to the proactive FAQ matcher.
 */
export interface FaqItem {
  readonly q: string;
  readonly a: string;
}

/**
 * A ranked FAQ suggestion: the original entry plus how many normalized
 * words it shares with the user question.
 */
export interface FaqSuggestion {
  readonly q: string;
  readonly a: string;
  readonly score: number;
}

/**
 * Options for suggestFaqAnswers. `limit` caps how many suggestions are
 * returned (default 3). A limit of 0 or less yields an empty list.
 */
export interface SuggestFaqOptions {
  readonly limit?: number;
}

const DEFAULT_LIMIT = 3;

/**
 * Normalizes text into a list of comparable words: lowercased, with accents
 * and tildes stripped, split on any non-alphanumeric run, empties removed.
 * Pure and deterministic.
 */
const normalizeWords = (text: string): readonly string[] => {
  const stripped = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const tokens = stripped.split(/[^a-z0-9]+/);
  const words: string[] = [];
  for (const token of tokens) {
    if (token.length > 0) {
      words.push(token);
    }
  }
  return words;
};

/**
 * Proactively suggests FAQ answers for a user question before they finish
 * asking. Scores each entry by the count of distinct normalized words it
 * shares with the question, drops zero-score entries, sorts by score
 * descending and then by question text ascending for stable ties, and
 * returns at most `options.limit` (default 3) suggestions. An undefined or
 * word-less question yields an empty list.
 * Pure and deterministic.
 */
export const suggestFaqAnswers = (
  question: string | undefined,
  faq: readonly FaqItem[],
  options?: SuggestFaqOptions,
): readonly FaqSuggestion[] => {
  const limit = options?.limit ?? DEFAULT_LIMIT;
  if (limit <= 0 || question === undefined) {
    return [];
  }
  const questionWords = new Set(normalizeWords(question));
  if (questionWords.size === 0) {
    return [];
  }
  const scored: FaqSuggestion[] = [];
  for (const entry of faq) {
    const entryWords = new Set(normalizeWords(entry.q));
    let score = 0;
    for (const word of entryWords) {
      if (questionWords.has(word)) {
        score += 1;
      }
    }
    if (score > 0) {
      scored.push({ q: entry.q, a: entry.a, score });
    }
  }
  scored.sort((first, second) => {
    if (second.score !== first.score) {
      return second.score - first.score;
    }
    if (first.q < second.q) {
      return -1;
    }
    if (first.q > second.q) {
      return 1;
    }
    return 0;
  });
  return scored.slice(0, limit);
};
