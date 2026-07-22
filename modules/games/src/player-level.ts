/**
 * Nivel de jugador a partir de puntos acumulados. Logica pura y determinista:
 * el umbral para ALCANZAR el nivel L son 25·L·(L−1) puntos acumulados, o sea
 * 0, 50, 150, 300, 500, 750, 1050, 1400… (cada nivel cuesta un poco mas que el
 * anterior). Sin I/O ni Date.now(); los callers pasan los puntos.
 */

const LEVEL_CAP = 999;

/** Puntos acumulados necesarios para alcanzar `level` (>=1). */
const thresholdFor = (level: number): number => 25 * level * (level - 1);

export interface PlayerLevel {
  readonly level: number;
  /** Puntos (saneados) usados para el calculo. */
  readonly points: number;
  /** Puntos al inicio de este nivel (umbral del nivel actual). */
  readonly floor: number;
  /** Puntos para alcanzar el siguiente nivel (umbral del nivel+1). */
  readonly ceil: number;
}

export const levelForPoints = (points: number): PlayerLevel => {
  const p = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
  let level = 1;
  while (level < LEVEL_CAP && thresholdFor(level + 1) <= p) {
    level += 1;
  }
  return {
    level,
    points: p,
    floor: thresholdFor(level),
    ceil: thresholdFor(level + 1),
  };
};
