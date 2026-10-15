/**
 * Part of the day derived from the hour: madrugada, manana, tarde or noche.
 * Pure and deterministic.
 */
export type DayPhase = "madrugada" | "manana" | "tarde" | "noche";

/** Moderation strictness recommended for a day phase. */
export type DayPhaseStrictness = "suave" | "normal" | "estricto";

/**
 * The recommended rule posture for a given part of the day. Pure and
 * deterministic.
 */
export interface DayPhaseRules {
  readonly phase: DayPhase;
  readonly strictness: DayPhaseStrictness;
}

/**
 * Maps an hour of day to a phase and recommended strictness: madrugada (0-5)
 * estricto, manana (6-11) suave, tarde (12-18) normal, noche (19-23) estricto.
 * The hour is floored and wrapped into 0..23 so any integer is safe.
 * Pure and deterministic.
 */
export const rulesForDayPhase = (hourOfDay: number): DayPhaseRules => {
  const hour = ((Math.floor(hourOfDay) % 24) + 24) % 24;
  if (hour <= 5) {
    return { phase: "madrugada", strictness: "estricto" };
  }
  if (hour <= 11) {
    return { phase: "manana", strictness: "suave" };
  }
  if (hour <= 18) {
    return { phase: "tarde", strictness: "normal" };
  }
  return { phase: "noche", strictness: "estricto" };
};
