/**
 * A single healthy-streak achievement a member can unlock by participating,
 * helping and not breaking the rules for a number of consecutive days.
 * Pure and deterministic.
 */
export interface StreakAchievement {
  /** Stable ASCII identifier for this achievement. */
  readonly id: string;
  /** User-facing Spanish title (with accents and emoji). */
  readonly title: string;
}

/** Internal milestone definition: the day threshold plus its achievement. */
interface StreakMilestone {
  readonly threshold: number;
  readonly achievement: StreakAchievement;
}

/**
 * Curated healthy-streak milestones, ordered ascending by threshold.
 * Unlocked at 3, 7 and 30 consecutive days of healthy participation.
 * Pure and deterministic.
 */
const STREAK_MILESTONES: readonly StreakMilestone[] = [
  {
    threshold: 3,
    achievement: {
      id: "racha_constante",
      title: "🌱 Racha constante: 3 días participando sano",
    },
  },
  {
    threshold: 7,
    achievement: {
      id: "semana_saludable",
      title: "⭐ Semana saludable: 7 días ayudando y sin romper normas",
    },
  },
  {
    threshold: 30,
    achievement: {
      id: "leyenda_comunitaria",
      title: "🏆 Leyenda comunitaria: 30 días de racha ejemplar",
    },
  },
];

/**
 * Returns the healthy-streak achievements unlocked for a given number of
 * consecutive healthy days, in curated ascending order. Only milestones whose
 * threshold has been reached are included; fractional days count toward the
 * threshold they meet or exceed. Non-finite or non-positive inputs yield an
 * empty list. Pure and deterministic.
 */
export const evaluateStreakAchievements = (
  streakDays: number,
): readonly StreakAchievement[] => {
  if (!Number.isFinite(streakDays) || streakDays <= 0) {
    return [];
  }
  const unlocked: StreakAchievement[] = [];
  for (const milestone of STREAK_MILESTONES) {
    if (streakDays >= milestone.threshold) {
      unlocked.push(milestone.achievement);
    }
  }
  return unlocked;
};
