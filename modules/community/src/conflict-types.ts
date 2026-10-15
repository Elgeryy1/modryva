/**
 * A single conflict record fed into the tally. Only the `type` label is used;
 * any other fields on the caller's objects are ignored.
 */
export interface ConflictRecord {
  readonly type: string;
}

/**
 * One row of the conflict-type breakdown: the conflict `type`, how many times
 * it occurred (`count`), and its share of the total as a whole-number
 * percentage (`percent`).
 */
export interface ConflictTypeTally {
  readonly type: string;
  readonly count: number;
  readonly percent: number;
}

/**
 * Tallies conflict records by their `type`, returning one row per distinct
 * type with its occurrence count and percentage of the grand total. `percent`
 * is Math.round(count / total * 100), so rows need not sum to exactly 100.
 * Rows are sorted by count descending, ties broken by type ascending (ASCII
 * code-unit order). Type strings are compared exactly (case-sensitive, no
 * trimming). Empty input yields an empty array. Pure and deterministic.
 */
export const tallyConflictTypes = (
  conflicts: readonly ConflictRecord[],
): readonly ConflictTypeTally[] => {
  const total = conflicts.length;
  if (total === 0) {
    return [];
  }
  const counts = new Map<string, number>();
  for (const conflict of conflicts) {
    const current = counts.get(conflict.type) ?? 0;
    counts.set(conflict.type, current + 1);
  }
  const rows: ConflictTypeTally[] = [];
  for (const [type, count] of counts) {
    rows.push({ type, count, percent: Math.round((count / total) * 100) });
  }
  rows.sort((a, b) => {
    if (a.count !== b.count) {
      return b.count - a.count;
    }
    if (a.type < b.type) {
      return -1;
    }
    if (a.type > b.type) {
      return 1;
    }
    return 0;
  });
  return rows;
};
