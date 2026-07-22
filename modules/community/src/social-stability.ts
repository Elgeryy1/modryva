/**
 * Social stability map for a group. This does NOT measure technical health;
 * it estimates how socially stable a community is based on how many conflicts
 * arise, how many get resolved, and how dense conflicts are per active member.
 */

/** Qualitative stability band for a group. Pure and deterministic. */
export type SocialStabilityBand = "inestable" | "fragil" | "estable";

/** Raw social signals gathered over a window for a single group. Pure and deterministic. */
export interface SocialStabilityInput {
  /** Number of conflicts observed in the window (negatives treated as 0). */
  readonly conflicts: number;
  /** Number of conflicts that reached a resolution (negatives treated as 0). */
  readonly resolutions: number;
  /** Count of active members in the window (negatives treated as 0). */
  readonly activeMembers: number;
}

/** Computed social stability outcome for a group. Pure and deterministic. */
export interface SocialStabilityMap {
  /** Stability score in the inclusive range 0..100. */
  readonly score: number;
  /** Band derived from the score by fixed thresholds. */
  readonly band: SocialStabilityBand;
}

/** Weight given to the resolution ratio component. */
const RESOLUTION_WEIGHT = 0.6;
/** Weight given to the conflict-density component. */
const DENSITY_WEIGHT = 0.4;
/** Score at or above which a group is considered stable. */
const STABLE_THRESHOLD = 70;
/** Score at or above which a group is considered fragile (below is unstable). */
const FRAGILE_THRESHOLD = 40;

/** Clamps a number to be at least zero, mapping NaN to zero. */
const atLeastZero = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 0;

/** Maps a numeric score to its stability band. */
const bandForScore = (score: number): SocialStabilityBand => {
  if (score >= STABLE_THRESHOLD) {
    return "estable";
  }
  if (score >= FRAGILE_THRESHOLD) {
    return "fragil";
  }
  return "inestable";
};

/**
 * Computes a social stability map for a group. Combines the resolution ratio
 * (resolutions / conflicts, capped at 1; a conflict-free group scores a full
 * ratio) with an inverse conflict density (conflicts per active member, capped
 * at 1). A group with no active members is treated as fully unstable. The score
 * is rounded to the nearest integer in 0..100 and bucketed into a band.
 * Pure and deterministic.
 */
export const computeSocialStability = (
  input: SocialStabilityInput,
): SocialStabilityMap => {
  const conflicts = atLeastZero(input.conflicts);
  const resolutions = atLeastZero(input.resolutions);
  const activeMembers = atLeastZero(input.activeMembers);

  if (activeMembers <= 0) {
    return { score: 0, band: "inestable" };
  }

  const resolutionRatio =
    conflicts <= 0 ? 1 : Math.min(1, resolutions / conflicts);
  const density = Math.min(1, conflicts / activeMembers);
  const densityScore = 1 - density;

  const raw =
    resolutionRatio * RESOLUTION_WEIGHT + densityScore * DENSITY_WEIGHT;
  const score = Math.round(raw * 100);

  return { score, band: bandForScore(score) };
};
