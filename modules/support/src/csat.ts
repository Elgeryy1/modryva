/**
 * CSAT (satisfaccion del cliente) tras resolver un ticket de soporte. Logica
 * pura y determinista: recibe los votos como datos planos y no toca reloj, red
 * ni almacenamiento. Un voto puntua de 1 a 5 estrellas; los votos con puntuacion
 * fuera de rango o no entera se descartan.
 */

/** Un voto de satisfaccion. `score` es 1..5; `ms` es el tiempo de resolucion. */
export interface CsatVote {
  readonly score: number;
  readonly ms: number;
}

/** Resumen agregado de una tanda de votos CSAT. */
export interface CsatSummary {
  /** Media de las puntuaciones validas, o null si no hay votos validos. */
  readonly average: number | null;
  /** Numero de votos validos considerados. */
  readonly count: number;
  /** Votos promotores: puntuacion exactamente 5. */
  readonly promoters: number;
  /** Votos detractores: puntuacion menor o igual a 3. */
  readonly detractors: number;
  /**
   * Net Promoter Score en el rango -100..100: (promotores - detractores) /
   * count * 100. Es null si no hay votos validos.
   */
  readonly nps: number | null;
}

/** Puntuacion minima aceptada por un voto valido. */
export const CSAT_MIN_SCORE = 1;
/** Puntuacion maxima aceptada por un voto valido. */
export const CSAT_MAX_SCORE = 5;
/** Puntuacion (inclusive) por debajo de la cual un voto cuenta como detractor. */
export const CSAT_DETRACTOR_MAX = 3;
/** Puntuacion que marca a un voto como promotor. */
export const CSAT_PROMOTER_SCORE = 5;

/**
 * True cuando el voto es utilizable: `score` es un entero dentro de
 * [CSAT_MIN_SCORE, CSAT_MAX_SCORE]. Pura y determinista.
 */
export const isValidCsatVote = (vote: CsatVote): boolean =>
  Number.isInteger(vote.score) &&
  vote.score >= CSAT_MIN_SCORE &&
  vote.score <= CSAT_MAX_SCORE;

/**
 * Agrega los votos CSAT en un resumen con media, promotores, detractores y NPS.
 * Los votos con puntuacion invalida se ignoran. Seguro ante lista vacia
 * (average y nps quedan en null; el resto en 0). Pura y determinista.
 */
export const computeCsat = (votes: readonly CsatVote[]): CsatSummary => {
  let count = 0;
  let sum = 0;
  let promoters = 0;
  let detractors = 0;

  for (const vote of votes) {
    if (!isValidCsatVote(vote)) {
      continue;
    }
    count += 1;
    sum += vote.score;
    if (vote.score >= CSAT_PROMOTER_SCORE) {
      promoters += 1;
    }
    if (vote.score <= CSAT_DETRACTOR_MAX) {
      detractors += 1;
    }
  }

  if (count === 0) {
    return { average: null, count: 0, promoters: 0, detractors: 0, nps: null };
  }

  return {
    average: sum / count,
    count,
    promoters,
    detractors,
    nps: ((promoters - detractors) / count) * 100,
  };
};
