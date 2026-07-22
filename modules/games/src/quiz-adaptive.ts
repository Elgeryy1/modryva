/**
 * Quiz adaptativo por dificultad. Ajusta el nivel (1..5) segun el rendimiento
 * del jugador: sube cuando la precision es alta, baja cuando es baja y se
 * mantiene en la zona media. Logica pura y determinista: sin I/O ni azar.
 */

/** Nivel de dificultad discreto del quiz. */
export type QuizDifficulty = 1 | 2 | 3 | 4 | 5;

/** Rendimiento acumulado de un jugador en una tanda de preguntas. */
export interface QuizPerf {
  /** Respuestas correctas (se trata como 0 si es negativo). */
  readonly correct: number;
  /** Preguntas respondidas (se trata como 0 si es negativo). */
  readonly total: number;
}

/** Umbral de precision a partir del cual la dificultad sube. */
export const QUIZ_RAISE_THRESHOLD = 0.8;

/** Umbral de precision por debajo del cual la dificultad baja. */
export const QUIZ_LOWER_THRESHOLD = 0.4;

const QUIZ_MIN_DIFFICULTY: QuizDifficulty = 1;
const QUIZ_MAX_DIFFICULTY: QuizDifficulty = 5;

const clampDifficulty = (value: number): QuizDifficulty => {
  if (value <= QUIZ_MIN_DIFFICULTY) {
    return QUIZ_MIN_DIFFICULTY;
  }
  if (value >= QUIZ_MAX_DIFFICULTY) {
    return QUIZ_MAX_DIFFICULTY;
  }
  return value as QuizDifficulty;
};

/**
 * Precision (0..1) del rendimiento. Segura ante total 0 (o negativo), en cuyo
 * caso devuelve 0. Los valores negativos de correct se tratan como 0 y el
 * resultado nunca supera 1. Pura y determinista.
 */
export const accuracy = (perf: QuizPerf): number => {
  const total = perf.total > 0 ? perf.total : 0;
  if (total === 0) {
    return 0;
  }
  const correct = perf.correct > 0 ? perf.correct : 0;
  const value = correct / total;
  return value > 1 ? 1 : value;
};

/**
 * Siguiente dificultad segun el rendimiento: sube un nivel si la precision es
 * alta (>= QUIZ_RAISE_THRESHOLD), baja un nivel si es baja (< QUIZ_LOWER_THRESHOLD)
 * y se mantiene en la zona media. El resultado siempre queda en el rango 1..5.
 * Sin preguntas respondidas la dificultad no cambia. Pura y determinista.
 */
export const nextDifficulty = (
  current: QuizDifficulty,
  perf: QuizPerf,
): QuizDifficulty => {
  const total = perf.total > 0 ? perf.total : 0;
  if (total === 0) {
    return current;
  }

  const acc = accuracy(perf);

  if (acc >= QUIZ_RAISE_THRESHOLD) {
    return clampDifficulty(current + 1);
  }
  if (acc < QUIZ_LOWER_THRESHOLD) {
    return clampDifficulty(current - 1);
  }
  return current;
};
