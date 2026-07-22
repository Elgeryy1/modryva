/**
 * Behavioural counters used to spot farming/abuse without showing anything to
 * the user. Pure and deterministic.
 */
export interface NegativeAchievementStats {
  readonly rapidPlays: number;
  readonly identicalActions: number;
  readonly nightGrind: number;
}

/** A hidden negative flag and the condition that raises it. */
interface NegativeAchievementRule {
  readonly id: string;
  readonly test: (stats: NegativeAchievementStats) => boolean;
}

/** Curated, ordered catalog of hidden negative flags. */
const NEGATIVE_ACHIEVEMENT_RULES: readonly NegativeAchievementRule[] = [
  { id: "farmer", test: (stats) => stats.rapidPlays >= 100 },
  { id: "robot", test: (stats) => stats.identicalActions >= 50 },
  { id: "night_grinder", test: (stats) => stats.nightGrind >= 30 },
];

/**
 * Evaluates hidden negative achievements used for abuse prevention (never shown
 * to players). Returns the ids whose thresholds are met, in the curated rule
 * order. Ids are plain ASCII internal markers. Pure and deterministic.
 */
export const detectNegativeAchievements = (
  stats: NegativeAchievementStats,
): readonly string[] => {
  const flags: string[] = [];
  for (const rule of NEGATIVE_ACHIEVEMENT_RULES) {
    if (rule.test(stats)) {
      flags.push(rule.id);
    }
  }
  return flags;
};
