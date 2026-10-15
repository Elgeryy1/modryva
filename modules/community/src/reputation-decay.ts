/**
 * Perdon automatico de reputacion: los warns acumulados de un usuario decaen
 * con el tiempo mientras no vuelva a infringir. Cada periodo de "vida media"
 * (halfLife) transcurrido sin nuevas infracciones reduce el conteo de warns en
 * 1, sin bajar nunca de cero. Logica pura y determinista: el llamador aporta
 * `nowMs` y todos los timestamps, este modulo no lee reloj ni estado externo.
 */

/**
 * Vida media por defecto del decaimiento de warns: 7 dias en milisegundos.
 * Tras 7 dias sin infringir el usuario recupera 1 warn; tras 14 dias, 2; etc.
 */
export const REPUTATION_DECAY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Numero de vidas medias completas transcurridas entre `lastOffenseMs` y
 * `nowMs`. Devuelve 0 cuando aun no ha pasado una vida media completa, cuando
 * `nowMs` es anterior a `lastOffenseMs` (reloj hacia atras) o cuando
 * `halfLifeMs` no es positivo. El resultado nunca es negativo. Puro.
 */
export const reputationDecaySteps = (
  lastOffenseMs: number,
  nowMs: number,
  halfLifeMs: number,
): number => {
  if (halfLifeMs <= 0) {
    return 0;
  }
  const elapsed = nowMs - lastOffenseMs;
  if (elapsed <= 0) {
    return 0;
  }
  return Math.floor(elapsed / halfLifeMs);
};

/**
 * Aplica el perdon automatico: parte de `activeWarns` y resta 1 por cada vida
 * media (`halfLifeMs`) transcurrida desde la ultima infraccion
 * (`lastOffenseMs`) hasta `nowMs`. El resultado se acota en el rango
 * [0, activeWarns]: nunca es negativo ni supera el conteo inicial. Con
 * `activeWarns` menor o igual a 0 devuelve 0, y con `halfLifeMs` no positivo
 * no decae nada (solo acota a 0). Puro y determinista.
 */
export const decayWarnCount = (
  activeWarns: number,
  lastOffenseMs: number,
  nowMs: number,
  halfLifeMs: number,
): number => {
  if (activeWarns <= 0) {
    return 0;
  }
  const steps = reputationDecaySteps(lastOffenseMs, nowMs, halfLifeMs);
  const remaining = activeWarns - steps;
  return remaining > 0 ? remaining : 0;
};

/**
 * Milisegundos que faltan para que caiga el siguiente warn por decaimiento, o
 * `null` cuando ya no queda nada por perdonar (el conteo decaido es 0) o
 * cuando `halfLifeMs` no es positivo. El valor devuelto es siempre positivo;
 * con `nowMs` dentro o despues del periodo activo es como maximo `halfLifeMs`.
 * Puro y determinista.
 */
export const msUntilNextReputationDecay = (
  activeWarns: number,
  lastOffenseMs: number,
  nowMs: number,
  halfLifeMs: number,
): number | null => {
  if (halfLifeMs <= 0) {
    return null;
  }
  const current = decayWarnCount(activeWarns, lastOffenseMs, nowMs, halfLifeMs);
  if (current <= 0) {
    return null;
  }
  const steps = reputationDecaySteps(lastOffenseMs, nowMs, halfLifeMs);
  const nextBoundaryMs = lastOffenseMs + (steps + 1) * halfLifeMs;
  return nextBoundaryMs - nowMs;
};
