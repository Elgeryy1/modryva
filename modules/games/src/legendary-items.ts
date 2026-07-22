/**
 * Rare milestone stats used to decide which legendary items a member has earned.
 * Legendary items are never purchasable: they are granted only on rare thresholds.
 * Pure and deterministic.
 */
export interface LegendaryItemStats {
  /** Number of raids the member survived (>= 5 unlocks the guardian item). */
  readonly raidsSurvived: number;
  /** Whole or fractional years the member has been active (>= 1 unlocks the veteran item). */
  readonly yearsActive: number;
  /** Whether the member currently holds the top-helper distinction (unlocks the beacon item). */
  readonly topHelper: boolean;
}

interface LegendaryRule {
  readonly id: string;
  readonly earned: (stats: LegendaryItemStats) => boolean;
}

/**
 * Curated, fixed award order. The output of awardLegendaryItems always follows
 * this order regardless of the stats provided, so results are stable.
 */
const LEGENDARY_RULES: readonly LegendaryRule[] = [
  { id: "guardian", earned: (s) => s.raidsSurvived >= 5 },
  { id: "veterano", earned: (s) => s.yearsActive >= 1 },
  { id: "faro", earned: (s) => s.topHelper },
];

/**
 * Returns the ids of the legendary items earned by a member, in the curated
 * LEGENDARY_RULES order. Legendary items are milestone-only and cannot be bought.
 * Returns an empty array when no rare threshold is met.
 * Pure and deterministic.
 */
export const awardLegendaryItems = (
  stats: LegendaryItemStats,
): readonly string[] => {
  const earned: string[] = [];
  for (const rule of LEGENDARY_RULES) {
    if (rule.earned(stats)) {
      earned.push(rule.id);
    }
  }
  return earned;
};
