/**
 * A single recorded conflict between two users, identified by their numeric ids.
 * Order of `a` and `b` is irrelevant: the pair is normalized before counting.
 */
export interface Conflict {
  readonly a: number;
  readonly b: number;
}

/**
 * A pair of users that repeatedly clash, with how many conflicts they share.
 * `pair` is always normalized to [min, max]. Pure and deterministic.
 */
export interface ClashingPair {
  readonly pair: readonly [number, number];
  readonly count: number;
}

/**
 * Options for detectClashingPairs.
 * `minClashes` is the inclusive lower bound on how many conflicts a pair must
 * have to appear in the result (default 2).
 */
export interface ClashingPairsOptions {
  readonly minClashes?: number;
}

const buildKey = (low: number, high: number): string => `${low}:${high}`;

/**
 * Builds a map of clashing user pairs from a list of recorded conflicts.
 *
 * Each conflict is normalized to [min, max] so that {a, b} and {b, a} are the
 * same pair. Self-conflicts (a === b) are ignored, since a user cannot clash
 * with themselves. Pairs are counted, filtered by `minClashes` (default 2),
 * and sorted by count descending, breaking ties by pair ascending (first the
 * lower id, then the higher id).
 *
 * Pure and deterministic.
 */
export const detectClashingPairs = (
  conflicts: readonly Conflict[],
  options?: ClashingPairsOptions,
): readonly ClashingPair[] => {
  const minClashes = options?.minClashes ?? 2;
  const counts = new Map<
    string,
    { readonly low: number; readonly high: number; count: number }
  >();

  for (const conflict of conflicts) {
    if (conflict.a === conflict.b) {
      continue;
    }
    const low = Math.min(conflict.a, conflict.b);
    const high = Math.max(conflict.a, conflict.b);
    const key = buildKey(low, high);
    const existing = counts.get(key);
    if (existing === undefined) {
      counts.set(key, { low, high, count: 1 });
    } else {
      existing.count += 1;
    }
  }

  const result: ClashingPair[] = [];
  for (const entry of counts.values()) {
    if (entry.count >= minClashes) {
      result.push({ pair: [entry.low, entry.high], count: entry.count });
    }
  }

  result.sort((first, second) => {
    if (first.count !== second.count) {
      return second.count - first.count;
    }
    if (first.pair[0] !== second.pair[0]) {
      return first.pair[0] - second.pair[0];
    }
    return first.pair[1] - second.pair[1];
  });

  return result;
};
