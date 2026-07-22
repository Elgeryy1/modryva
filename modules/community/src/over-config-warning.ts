/**
 * Input for the over-configuration check: how many moderation rules are
 * currently active and how many members the group has.
 * Pure and deterministic.
 */
export interface OverConfigInput {
  /** Number of moderation rules currently enabled. */
  readonly activeRules: number;
  /** Number of members in the group. */
  readonly memberCount: number;
}

/**
 * Result of the over-configuration check.
 * Pure and deterministic.
 */
export interface OverConfigResult {
  /** True when the group has too many rules for its size. */
  readonly warn: boolean;
  /** Active rules per 100 members, rounded to two decimals. */
  readonly ratioPer100: number;
  /** User-facing Spanish advice describing the situation. */
  readonly advice: string;
}

// Rules per 100 members at or below this ratio are considered a healthy balance.
const WARN_THRESHOLD_PER_100 = 5;
// Above this ratio the situation is considered critical, not just a warning.
const CRITICAL_THRESHOLD_PER_100 = 10;

// Rounds a number to two decimal places without floating helpers.
const roundToTwo = (value: number): number => Math.round(value * 100) / 100;

/**
 * Evaluates whether a group is over-configured, meaning it has too many
 * moderation rules for its member base, which tends to suppress activity.
 * Returns the rules-per-100-members ratio, a warn flag, and user-facing
 * Spanish advice. Empty groups and rule-less groups are handled without
 * dividing by zero and never raise a warning.
 * Pure and deterministic.
 */
export const checkOverConfiguration = (
  input: OverConfigInput,
): OverConfigResult => {
  const { activeRules, memberCount } = input;

  if (memberCount <= 0) {
    return {
      warn: false,
      ratioPer100: 0,
      advice:
        "Aún no puedo evaluar tus reglas porque el grupo no tiene miembros. 👥",
    };
  }

  if (activeRules <= 0) {
    return {
      warn: false,
      ratioPer100: 0,
      advice:
        "No tienes reglas activas. 👍 Empieza con lo básico y añade solo lo necesario.",
    };
  }

  const ratioPer100 = roundToTwo((activeRules / memberCount) * 100);

  if (ratioPer100 > CRITICAL_THRESHOLD_PER_100) {
    return {
      warn: true,
      ratioPer100,
      advice: `🚨 Exceso de reglas: ${activeRules} para ${memberCount} miembros. Simplifica o la gente dejará de participar.`,
    };
  }

  if (ratioPer100 > WARN_THRESHOLD_PER_100) {
    return {
      warn: true,
      ratioPer100,
      advice: `⚠️ Te estás pasando configurando: ${activeRules} reglas para ${memberCount} miembros. Demasiadas normas pueden matar la actividad.`,
    };
  }

  return {
    warn: false,
    ratioPer100,
    advice: `✅ Buen equilibrio: ${activeRules} reglas para ${memberCount} miembros. Deja que la comunidad respire.`,
  };
};
