/**
 * Progress summary for a group's seasonal collectible-card set.
 * ownedCount and totalCount count DISTINCT cards; missing lists the
 * distinct cards from the season set that the user does not own,
 * preserving the season-set order.
 * Pure and deterministic.
 */
export interface CardCollectionProgress {
  readonly ownedCount: number;
  readonly totalCount: number;
  readonly percent: number;
  readonly missing: readonly string[];
}

/**
 * Computes how much of a seasonal card set a user has collected.
 * Duplicate ids in either list are collapsed, so counts reflect DISTINCT
 * cards. missing = season cards not present in owned, in season-set order.
 * percent = round(ownedCount / totalCount * 100), and is 0 when the season
 * set is empty (division guard).
 * Pure and deterministic.
 */
export const computeCardCollectionProgress = (
  owned: readonly string[],
  total: readonly string[],
): CardCollectionProgress => {
  const ownedSet = new Set(owned);
  const seen = new Set<string>();
  const missing: string[] = [];
  let ownedCount = 0;
  let totalCount = 0;
  for (const card of total) {
    if (seen.has(card)) {
      continue;
    }
    seen.add(card);
    totalCount += 1;
    if (ownedSet.has(card)) {
      ownedCount += 1;
    } else {
      missing.push(card);
    }
  }
  const percent =
    totalCount === 0 ? 0 : Math.round((ownedCount / totalCount) * 100);
  return { ownedCount, totalCount, percent, missing };
};
