/**
 * A previously resolved moderation case: its identifier, the tags or keywords
 * that describe it, and the action a moderator took.
 */
export interface PastCase {
  readonly id: string;
  readonly tags: readonly string[];
  readonly action: string;
}

/**
 * A scored match against the current case: the past case id, the action that
 * was taken, and a similarity score in the range 0..1.
 */
export interface SimilarCase {
  readonly id: string;
  readonly action: string;
  readonly score: number;
}

/**
 * Options for findSimilarCases. limit caps how many matches are returned
 * (default 3); values below zero (and non-integers) are floored and clamped
 * to zero.
 */
export interface FindSimilarOptions {
  readonly limit?: number;
}

const DEFAULT_LIMIT = 3;

/** Rounds a ratio to four decimals for stable, comparable scores. */
const roundScore = (value: number): number => Math.round(value * 10000) / 10000;

/** Normalizes tags to a deduplicated set of trimmed, lowercased keywords. */
const toTagSet = (tags: readonly string[]): ReadonlySet<string> => {
  const set = new Set<string>();
  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase();
    if (normalized.length > 0) {
      set.add(normalized);
    }
  }
  return set;
};

/** Orders matches by score descending, breaking ties by id ascending. */
const byScoreThenId = (a: SimilarCase, b: SimilarCase): number => {
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
};

/**
 * Finds the past cases most similar to the current one by shared tags,
 * returning each match with the action that was taken and a Jaccard
 * similarity score (shared tags divided by the union of both tag sets,
 * rounded to four decimals). Tags are compared case-insensitively, trimmed,
 * and deduplicated. Cases with no shared tags are excluded. Results are
 * ordered by score descending, ties broken by id ascending, and capped at
 * options.limit (default 3). Pure and deterministic.
 */
export const findSimilarCases = (
  current: { readonly tags: readonly string[] },
  past: readonly PastCase[],
  options?: FindSimilarOptions,
): readonly SimilarCase[] => {
  const limit = Math.max(0, Math.floor(options?.limit ?? DEFAULT_LIMIT));
  if (limit === 0) {
    return [];
  }
  const currentSet = toTagSet(current.tags);
  const matches: SimilarCase[] = [];
  for (const candidate of past) {
    const candidateSet = toTagSet(candidate.tags);
    let shared = 0;
    for (const tag of candidateSet) {
      if (currentSet.has(tag)) {
        shared += 1;
      }
    }
    if (shared === 0) {
      continue;
    }
    const union = currentSet.size + candidateSet.size - shared;
    matches.push({
      id: candidate.id,
      action: candidate.action,
      score: roundScore(shared / union),
    });
  }
  return matches.sort(byScoreThenId).slice(0, limit);
};
