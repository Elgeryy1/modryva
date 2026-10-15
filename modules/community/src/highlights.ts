/**
 * A scored community message eligible to become an automatic highlight.
 * Pure data shape with no behavior.
 */
export interface Highlight {
  readonly id: string;
  readonly score: number;
}

/**
 * Tuning options for pickHighlights. Both fields are optional and fall back
 * to DEFAULT_LIMIT and DEFAULT_MIN_SCORE respectively.
 */
export interface HighlightOptions {
  readonly limit?: number;
  readonly minScore?: number;
}

/** Default maximum number of highlights returned. */
const DEFAULT_LIMIT = 5;

/** Default minimum score required for a message to qualify. */
const DEFAULT_MIN_SCORE = 1;

/**
 * Picks the best community contributions as automatic highlights. Keeps only
 * messages with score >= minScore (default 1), sorts by score descending with
 * ties broken by id ascending, and returns at most limit items (default 5).
 * Returns an empty array when limit <= 0 or nothing qualifies. Never mutates
 * the input. Pure and deterministic.
 */
export const pickHighlights = (
  messages: readonly Highlight[],
  options?: HighlightOptions,
): readonly Highlight[] => {
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const minScore = options?.minScore ?? DEFAULT_MIN_SCORE;
  if (limit <= 0) {
    return [];
  }
  const qualifying = messages.filter((message) => message.score >= minScore);
  const sorted = [...qualifying].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (a.id < b.id) {
      return -1;
    }
    if (a.id > b.id) {
      return 1;
    }
    return 0;
  });
  return sorted.slice(0, limit);
};
