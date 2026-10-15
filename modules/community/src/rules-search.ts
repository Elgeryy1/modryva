/**
 * A single rule that matched a search query, carrying its original position
 * in the source list and its unmodified text. Pure and deterministic.
 */
export interface RuleMatch {
  /** Zero-based index of the rule within the original list. */
  readonly index: number;
  /** Original, unmodified rule text. */
  readonly text: string;
}

/**
 * Lowercases and strips diacritic marks (accents, tildes) so comparisons are
 * both case-insensitive and accent-insensitive. Pure and deterministic.
 */
const normalize = (value: string): string =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Searches a list of rule texts and returns those that contain the query as a
 * case-insensitive, accent-insensitive substring. Results preserve the source
 * order and report each rule's original index. Surrounding whitespace in the
 * query is ignored; an empty or whitespace-only query yields an empty array.
 * Pure and deterministic.
 */
export const searchRules = (
  rules: readonly string[],
  query: string,
): readonly RuleMatch[] => {
  const needle = normalize(query.trim());
  if (needle.length === 0) {
    return [];
  }
  const matches: RuleMatch[] = [];
  for (const [index, rule] of rules.entries()) {
    if (normalize(rule).includes(needle)) {
      matches.push({ index, text: rule });
    }
  }
  return matches;
};
