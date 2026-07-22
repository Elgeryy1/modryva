/**
 * A single approved, reusable official answer keyed by trigger keywords.
 * Pure and deterministic.
 */
export interface ApprovedSolutionEntry {
  /** Trigger keywords that should surface this answer (matched accent-insensitively). */
  readonly keywords: readonly string[];
  /** The official, reusable answer text shown to the user. */
  readonly answer: string;
}

/**
 * Outcome of looking up an approved solution: the first matching answer, if any.
 * Pure and deterministic.
 */
export interface ApprovedSolutionMatch {
  /** The matching official answer, or undefined when nothing matched. */
  readonly answer: string | undefined;
  /** True when at least one solution shared a keyword with the query. */
  readonly matched: boolean;
}

/**
 * Lowercases and strips diacritics so matching ignores accents and case.
 * Internal helper, not exported.
 */
const foldText = (value: string): string =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Splits folded text into alphanumeric word tokens, dropping empties.
 * Internal helper, not exported.
 */
const tokenize = (value: string): readonly string[] =>
  foldText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);

/**
 * Finds the first approved solution whose keywords share a word token with the
 * query, comparing accent-insensitively and case-insensitively. Returns no match
 * for empty/undefined queries, empty solution banks, or when nothing overlaps.
 * Pure and deterministic.
 */
export const findApprovedSolution = (
  query: string | undefined,
  solutions: readonly ApprovedSolutionEntry[],
): ApprovedSolutionMatch => {
  if (!query) {
    return { answer: undefined, matched: false };
  }
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) {
    return { answer: undefined, matched: false };
  }
  for (const solution of solutions) {
    for (const keyword of solution.keywords) {
      const keywordTokens = tokenize(keyword);
      const shares = keywordTokens.some((token) => queryTokens.has(token));
      if (shares) {
        return { answer: solution.answer, matched: true };
      }
    }
  }
  return { answer: undefined, matched: false };
};
