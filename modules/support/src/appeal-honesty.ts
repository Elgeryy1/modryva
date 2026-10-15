/**
 * Reputacion de apelacion honesta. Un usuario apela sanciones; las apelaciones
 * aceptadas por un moderador demuestran buena fe y suben la reputacion, mientras
 * que las apelaciones abusivas (spam de apelaciones, insultos, argumentos de mala
 * fe) la bajan. La puntuacion resultante (0..100) resume cuanto se puede confiar
 * en las apelaciones futuras de ese usuario. Logica pura y determinista: recibe
 * el historial plano y no toca reloj, red ni almacenamiento.
 */

/** Una entrada del historial de apelaciones de un usuario. */
export interface AppealHonestyEntry {
  /** true si la apelacion fue aceptada por un moderador. */
  readonly accepted: boolean;
  /** true si la apelacion fue marcada como abusiva o de mala fe. */
  readonly wasAbusive: boolean;
}

/** Nivel de confianza derivado de la puntuacion de honestidad. */
export type AppealHonestyTrust = "bajo" | "medio" | "alto";

export interface AppealHonestyScore {
  /** Puntuacion final acotada a 0..100. */
  readonly score: number;
  /** Etiqueta de confianza asociada a la puntuacion. */
  readonly trust: AppealHonestyTrust;
}

/** Puntuacion neutral de partida para un usuario sin historial. */
export const APPEAL_HONESTY_START = 50;

/** Cuanto suma cada apelacion aceptada. */
export const APPEAL_HONESTY_ACCEPT_BONUS = 12;

/** Cuanto resta cada apelacion abusiva. */
export const APPEAL_HONESTY_ABUSE_PENALTY = 20;

/** Umbral (inclusive por debajo) para confianza "bajo". */
export const APPEAL_HONESTY_LOW_MAX = 40;

/** Umbral (inclusive por debajo) para confianza "medio". */
export const APPEAL_HONESTY_MEDIUM_MAX = 70;

const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

/**
 * Traduce una puntuacion 0..100 a su etiqueta de confianza. Puntuaciones por
 * debajo de APPEAL_HONESTY_LOW_MAX son "bajo", por debajo de
 * APPEAL_HONESTY_MEDIUM_MAX son "medio", y el resto "alto". Pura y determinista.
 */
export const appealHonestyTrust = (score: number): AppealHonestyTrust => {
  if (score < APPEAL_HONESTY_LOW_MAX) {
    return "bajo";
  }
  if (score < APPEAL_HONESTY_MEDIUM_MAX) {
    return "medio";
  }
  return "alto";
};

/**
 * Calcula la reputacion de apelacion honesta a partir del historial. Se parte de
 * APPEAL_HONESTY_START; cada apelacion aceptada suma APPEAL_HONESTY_ACCEPT_BONUS
 * y cada apelacion abusiva resta APPEAL_HONESTY_ABUSE_PENALTY (ambos efectos son
 * independientes, asi que una entrada aceptada y a la vez abusiva aplica los dos).
 * El resultado se acota a 0..100. Segura ante historial vacio (devuelve el punto
 * de partida). Pura y determinista.
 */
export const scoreAppealHonesty = (
  history: readonly AppealHonestyEntry[],
): AppealHonestyScore => {
  let raw = APPEAL_HONESTY_START;

  for (const entry of history) {
    if (entry.accepted) {
      raw += APPEAL_HONESTY_ACCEPT_BONUS;
    }
    if (entry.wasAbusive) {
      raw -= APPEAL_HONESTY_ABUSE_PENALTY;
    }
  }

  const score = clamp(raw, 0, 100);

  return { score, trust: appealHonestyTrust(score) };
};
