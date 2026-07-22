/**
 * Positive-behavior stats used to evaluate rare secret achievements.
 * All counts are non-negative integers; negative or fractional values are
 * simply compared numerically against the thresholds.
 * Pure and deterministic.
 */
export interface SecretAchievementStats {
  /** Number of times the member helped others (answered, guided, supported). */
  readonly helps: number;
  /** Messages sent during night hours, a proxy for late-night activity. */
  readonly nightMessages: number;
  /** Consecutive days without any moderation warning or strike. */
  readonly cleanDays: number;
}

/**
 * A single unlocked secret achievement. The id is a stable ASCII slug for
 * storage/lookup; the title is the user-facing Spanish label with emoji.
 * Pure and deterministic.
 */
export interface SecretAchievement {
  readonly id: string;
  readonly title: string;
}

interface SecretAchievementRule {
  readonly id: string;
  readonly title: string;
  readonly isUnlocked: (stats: SecretAchievementStats) => boolean;
}

/**
 * Curated catalog of secret achievements in stable display order. The order
 * here is the order in which unlocked achievements are returned.
 * Pure and deterministic.
 */
const SECRET_ACHIEVEMENT_CATALOG: readonly SecretAchievementRule[] = [
  {
    id: "mentor",
    title: "🧑‍🏫 Mentor de la comunidad",
    isUnlocked: (stats) => stats.helps >= 50,
  },
  {
    id: "buho-nocturno",
    title: "🦉 Búho nocturno",
    isUnlocked: (stats) => stats.nightMessages >= 100,
  },
  {
    id: "impecable",
    title: "✨ Historial impecable",
    isUnlocked: (stats) => stats.cleanDays >= 30,
  },
];

/**
 * Evaluates which rare secret achievements a member has unlocked from their
 * positive-behavior stats. Returns the matching achievements in the curated
 * catalog order, never mutating the input. Returns an empty array when no
 * threshold is met.
 * Pure and deterministic.
 */
export const evaluateSecretAchievements = (
  stats: SecretAchievementStats,
): readonly SecretAchievement[] => {
  const unlocked: SecretAchievement[] = [];
  for (const rule of SECRET_ACHIEVEMENT_CATALOG) {
    if (rule.isUnlocked(stats)) {
      unlocked.push({ id: rule.id, title: rule.title });
    }
  }
  return unlocked;
};
