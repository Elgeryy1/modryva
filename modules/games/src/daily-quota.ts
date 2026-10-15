/**
 * Progress of a mission quota for the current day.
 * Pure and deterministic.
 */
export interface DailyQuota {
  /** Missions already completed today (negatives and decimals are clamped). */
  readonly doneToday: number;
  /** Maximum missions allowed per day (negatives and decimals are clamped). */
  readonly cap: number;
}

/**
 * Result of evaluating a daily mission quota.
 * Pure and deterministic.
 */
export interface QuotaCheck {
  /** Whether the user may complete another mission today. */
  readonly allowed: boolean;
  /** Missions still available today, never below zero. */
  readonly remaining: number;
  /** User-facing Spanish summary with correct accents. */
  readonly message: string;
}

/**
 * Clamps an arbitrary numeric input to a non-negative integer count.
 * Non-finite, negative or fractional values collapse to a safe floor.
 */
const toCount = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
};

/** Returns the singular or plural Spanish noun for missions. */
const pluralMisiones = (count: number): string =>
  count === 1 ? "misión" : "misiones";

/**
 * Evaluates a daily mission quota to prevent endless grinding. Clamps invalid
 * counts to non-negative integers, computes the remaining allowance and builds
 * a user-facing Spanish message. A cap of zero means no missions are offered
 * today. Pure and deterministic.
 */
export const checkDailyQuota = (input: DailyQuota): QuotaCheck => {
  const cap = toCount(input.cap);
  const done = toCount(input.doneToday);
  const remaining = Math.max(0, cap - done);

  if (cap === 0) {
    return {
      allowed: false,
      remaining: 0,
      message: "🚫 No hay misiones disponibles hoy.",
    };
  }

  if (remaining > 0) {
    return {
      allowed: true,
      remaining,
      message: `✅ Aún puedes completar ${remaining} ${pluralMisiones(remaining)} hoy.`,
    };
  }

  return {
    allowed: false,
    remaining: 0,
    message: `🎯 Ya completaste tu cupo diario de ${cap} ${pluralMisiones(cap)}. ¡Vuelve mañana!`,
  };
};
