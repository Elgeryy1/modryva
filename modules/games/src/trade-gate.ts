/**
 * Mercado limitado por reputacion (anti-abuso). Los usuarios nuevos o de baja
 * reputacion no pueden tradear, para evitar cuentas desechables que estafan y
 * huyen. Logica pura y determinista: recibe datos planos del usuario y opciones
 * opcionales, sin I/O, red, ni fuentes de tiempo/azar.
 */

/** Antiguedad minima de la cuenta (en dias) para poder tradear por defecto. */
export const TRADE_DEFAULT_MIN_AGE_DAYS = 7;

/** Reputacion minima para poder tradear por defecto. */
export const TRADE_DEFAULT_MIN_REP = 10;

/** Datos planos del usuario evaluados por la puerta de trade. */
export interface TradeUser {
  /** Antiguedad de la cuenta en dias (>= 0). */
  readonly ageDays: number;
  /** Reputacion acumulada del usuario. */
  readonly reputation: number;
  /** Numero de trades completados con exito. */
  readonly trades: number;
}

/** Umbrales opcionales que sobreescriben los valores por defecto. */
export interface TradeGateOptions {
  /** Antiguedad minima de la cuenta (en dias). */
  readonly minAgeDays?: number;
  /** Reputacion minima requerida. */
  readonly minReputation?: number;
}

/** Resultado de la evaluacion: permitido o no, con una razon legible. */
export interface TradeGateResult {
  readonly allowed: boolean;
  readonly reason: string;
}

/**
 * Decide si un usuario puede tradear. Un usuario con al menos un trade previo
 * exitoso se considera de confianza y pasa siempre (ya supero la puerta antes).
 * En caso contrario debe cumplir la antiguedad minima y la reputacion minima.
 * Devuelve `allowed:false` con la primera razon incumplida, evaluando primero la
 * antiguedad y luego la reputacion. Pura y determinista.
 */
export const canTrade = (
  user: TradeUser,
  opts?: TradeGateOptions,
): TradeGateResult => {
  const minAgeDays = opts?.minAgeDays ?? TRADE_DEFAULT_MIN_AGE_DAYS;
  const minReputation = opts?.minReputation ?? TRADE_DEFAULT_MIN_REP;

  if (user.trades > 0) {
    return { allowed: true, reason: "Trader con historial verificado." };
  }

  if (user.ageDays < minAgeDays) {
    return {
      allowed: false,
      reason: `Tu cuenta debe tener al menos ${minAgeDays} días para tradear.`,
    };
  }

  if (user.reputation < minReputation) {
    return {
      allowed: false,
      reason: `Necesitas al menos ${minReputation} de reputación para tradear.`,
    };
  }

  return { allowed: true, reason: "Cumples los requisitos para tradear." };
};
