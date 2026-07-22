/**
 * Prestige system: reset the level to earn a special rank mark.
 * Pure logic with plain inputs and no I/O, no Prisma, no network,
 * no Date.now() and no Math.random().
 *
 * Idea #534 from the Modryva bank: when a player reaches the max level they
 * may "prestige", resetting their level in exchange for a higher prestige tier
 * and a special Spanish rank title.
 */

/** Flat progression state of a player: current level and prestige count. */
export interface PrestigeInput {
  readonly level: number;
  readonly prestige: number;
}

/** Optional tuning: `maxLevel` is the level required to prestige (default 100). */
export interface PrestigeOptions {
  readonly maxLevel?: number;
}

/**
 * Result of evaluating a prestige state: whether the player may prestige now,
 * the prestige value after a reset, and the Spanish rank title for the tier.
 */
export interface PrestigeResult {
  readonly canPrestige: boolean;
  readonly nextPrestige: number;
  readonly title: string;
}

/** Default level a player must reach before being allowed to prestige. */
const DEFAULT_MAX_LEVEL = 100;

/** A prestige tier: the minimum prestige (inclusive) and its Spanish title. */
interface PrestigeTier {
  readonly min: number;
  readonly title: string;
}

/**
 * Prestige tiers ordered from highest to lowest threshold. The first tier whose
 * `min` is less than or equal to the prestige value provides the title. The
 * floor tier (min 0) guarantees a match for any non-negative prestige.
 */
const PRESTIGE_TIERS: readonly PrestigeTier[] = [
  { min: 10, title: "Leyenda" },
  { min: 5, title: "Campeón" },
  { min: 3, title: "Maestro" },
  { min: 2, title: "Veterano" },
  { min: 1, title: "Aprendiz" },
  { min: 0, title: "Novato" },
];

/** Fallback title used when no tier matches (only for negative prestige). */
const FLOOR_TITLE = "Novato";

/** Clamps a value to a non-negative integer; invalid input becomes 0. */
const toCount = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
};

/** Resolves the max level, using DEFAULT_MAX_LEVEL for missing or invalid input. */
const resolveMaxLevel = (value: number | undefined): number => {
  if (value === undefined || !Number.isFinite(value) || value < 1) {
    return DEFAULT_MAX_LEVEL;
  }
  return Math.floor(value);
};

/**
 * Returns the Spanish rank title for a prestige value: the highest tier whose
 * threshold is reached. Non-negative values always match a tier.
 * Pure and deterministic.
 */
const titleForPrestige = (prestige: number): string => {
  for (const tier of PRESTIGE_TIERS) {
    if (prestige >= tier.min) {
      return tier.title;
    }
  }
  return FLOOR_TITLE;
};

/**
 * Evaluates a player's prestige state. A player may prestige once the level
 * reaches `maxLevel` (default 100); doing so raises the prestige by one.
 * `nextPrestige` is the prestige after a reset (unchanged when not eligible),
 * and `title` is the Spanish rank for the current prestige tier. Non-integer or
 * negative inputs are clamped to non-negative integers.
 * Pure and deterministic.
 */
export const computePrestige = (
  input: PrestigeInput,
  options: PrestigeOptions = {},
): PrestigeResult => {
  const level = toCount(input.level);
  const prestige = toCount(input.prestige);
  const maxLevel = resolveMaxLevel(options.maxLevel);
  const canPrestige = level >= maxLevel;
  const nextPrestige = canPrestige ? prestige + 1 : prestige;
  return {
    canPrestige,
    nextPrestige,
    title: titleForPrestige(prestige),
  };
};
