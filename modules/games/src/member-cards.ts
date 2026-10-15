/**
 * Collectible member card system: each community member owns a card whose
 * rank and power are derived from their achievements and helpful actions.
 * Pure and deterministic.
 */

/**
 * Rank tiers a member card can reach, ordered from lowest to highest prestige.
 * Pure and deterministic.
 */
export type MemberCardRank = "bronce" | "plata" | "oro" | "diamante";

/**
 * Raw stats used to build a member card. Negative or fractional values are
 * normalized (floored and clamped to zero) before scoring.
 * Pure and deterministic.
 */
export interface MemberCardInput {
  readonly userId: number;
  readonly achievements: number;
  readonly helps: number;
}

/**
 * A generated member card: the owner id, the computed power score and the
 * rank tier that power unlocks.
 * Pure and deterministic.
 */
export interface MemberCard {
  readonly userId: number;
  readonly rank: MemberCardRank;
  readonly power: number;
}

/**
 * Points awarded per achievement when scoring a card.
 */
const POINTS_PER_ACHIEVEMENT = 10;

/**
 * Points awarded per recorded help when scoring a card.
 */
const POINTS_PER_HELP = 5;

/**
 * Rank tiers with their minimum required power, ordered from highest to
 * lowest so the first satisfied threshold wins.
 */
const RANK_TIERS: readonly {
  readonly rank: MemberCardRank;
  readonly minPower: number;
}[] = [
  { rank: "diamante", minPower: 300 },
  { rank: "oro", minPower: 150 },
  { rank: "plata", minPower: 50 },
  { rank: "bronce", minPower: 0 },
];

/**
 * Normalizes a raw stat to a non-negative integer.
 * Pure and deterministic.
 */
const normalizeStat = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
};

/**
 * Builds a member card from a member's achievement and help counts.
 * Power is achievements * 10 + helps * 5; the rank is the highest tier whose
 * minimum power the member meets. Inputs are normalized to non-negative
 * integers, so negative or fractional stats never yield a negative power.
 * Pure and deterministic.
 */
export const buildMemberCard = (input: MemberCardInput): MemberCard => {
  const achievements = normalizeStat(input.achievements);
  const helps = normalizeStat(input.helps);
  const power = achievements * POINTS_PER_ACHIEVEMENT + helps * POINTS_PER_HELP;
  let rank: MemberCardRank = "bronce";
  for (const tier of RANK_TIERS) {
    if (power >= tier.minPower) {
      rank = tier.rank;
      break;
    }
  }
  return { userId: input.userId, rank, power };
};
