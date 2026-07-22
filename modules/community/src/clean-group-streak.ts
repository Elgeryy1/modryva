/**
 * A single day of group activity. `hadIncident` is true when that day saw any
 * conflict, spam or moderation action worth breaking the clean streak.
 * Pure and deterministic.
 */
export interface DaySummary {
  readonly hadIncident: boolean;
}

/**
 * Result of evaluating a group's clean streak.
 * - `streak`: consecutive incident-free days counting back from the newest day.
 * - `clean`: whether the streak reached the configured threshold.
 * - `message`: user-facing Spanish summary (with emoji) ready to post.
 * Pure and deterministic.
 */
export interface CleanStreakResult {
  readonly streak: number;
  readonly clean: boolean;
  readonly message: string;
}

/**
 * Returns "dia" or "dias" depending on the count. Internal helper.
 * Pure and deterministic.
 */
const dayWord = (n: number): string => (n === 1 ? "día" : "días");

/**
 * Returns the correct verb form ("Falta" or "Faltan") for the count.
 * Internal helper. Pure and deterministic.
 */
const faltaWord = (n: number): string => (n === 1 ? "Falta" : "Faltan");

/**
 * Builds the user-facing Spanish message for the given streak state.
 * Internal helper. Pure and deterministic.
 */
const buildMessage = (
  total: number,
  streak: number,
  threshold: number,
  clean: boolean,
): string => {
  if (total === 0) {
    return "📊 Aún no hay días registrados para evaluar al grupo.";
  }
  if (streak === 0) {
    return "⚠️ Hubo un incidente reciente; el contador de días limpios vuelve a cero.";
  }
  if (clean) {
    return `🎉 ¡Grupo limpio! ${streak} ${dayWord(streak)} sin conflictos ni spam.`;
  }
  const remaining = threshold - streak;
  return `✨ ${streak} ${dayWord(streak)} sin incidentes. ${faltaWord(remaining)} ${remaining} ${dayWord(
    remaining,
  )} para el modo grupo limpio.`;
};

/**
 * Computes the "clean group" streak: the number of trailing days (from the end
 * of the array, i.e. the most recent day) with no incident, and whether that
 * streak reaches `thresholdDays`. A non-positive threshold is clamped to 1.
 * An `undefined` slot is treated as an incident and breaks the streak.
 * The returned `message` is a Spanish summary ready to show to admins.
 * Pure and deterministic.
 */
export const computeCleanStreak = (
  days: readonly DaySummary[],
  thresholdDays = 7,
): CleanStreakResult => {
  const threshold = thresholdDays > 0 ? thresholdDays : 1;
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    const day = days[i];
    if (day === undefined || day.hadIncident) {
      break;
    }
    streak += 1;
  }
  const clean = streak >= threshold;
  const message = buildMessage(days.length, streak, threshold, clean);
  return { streak, clean, message };
};
