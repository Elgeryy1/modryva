/**
 * Repaso espaciado de flashcards (SM-2 simplificado). Logica pura y
 * determinista: no hay I/O, red, Prisma, Date.now() ni Math.random(). Toda la
 * informacion temporal entra por `nowMs` y sale en los campos de la tarjeta.
 *
 * Modelo: `easeMillis` es el intervalo actual (en milisegundos) hasta el
 * proximo repaso. Una nota baja lo reduce (repasar pronto); una alta lo
 * multiplica (intervalo mayor). El intervalo queda siempre acotado entre
 * FLASHCARD_MIN_EASE_MS y FLASHCARD_MAX_EASE_MS.
 */

/** Intervalo minimo tras un repaso: 1 minuto. */
export const FLASHCARD_MIN_EASE_MS = 60_000;

/** Intervalo maximo tras un repaso: 365 dias. */
export const FLASHCARD_MAX_EASE_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Nota de repaso: 0 = fallo (reiniciar), 1 = dificil, 2 = bien, 3 = facil.
 */
export type FlashcardGrade = 0 | 1 | 2 | 3;

/**
 * Tarjeta de repaso. `easeMillis` es el intervalo vigente en milisegundos y
 * `dueMs` el instante (epoch ms) en que toca repasar.
 */
export interface Flashcard {
  readonly id: string;
  readonly easeMillis: number;
  readonly dueMs: number;
}

/**
 * Factor por el que se multiplica el intervalo segun la nota. Un switch (en
 * vez de indexar un objeto) evita el `T | undefined` de noUncheckedIndexedAccess
 * y mantiene el mapa exhaustivo sobre la union FlashcardGrade.
 */
const gradeMultiplier = (grade: FlashcardGrade): number => {
  switch (grade) {
    case 0:
      return 0; // fallo: el intervalo cae al minimo tras acotar
    case 1:
      return 1.2; // dificil: crece poco
    case 2:
      return 2.5; // bien
    case 3:
      return 3.5; // facil: crece mucho
  }
};

/** Acota `value` al rango [FLASHCARD_MIN_EASE_MS, FLASHCARD_MAX_EASE_MS]. */
const clampEase = (value: number): number => {
  if (value < FLASHCARD_MIN_EASE_MS) {
    return FLASHCARD_MIN_EASE_MS;
  }
  if (value > FLASHCARD_MAX_EASE_MS) {
    return FLASHCARD_MAX_EASE_MS;
  }
  return value;
};

/**
 * Aplica un repaso a la tarjeta y devuelve una NUEVA tarjeta (no muta la
 * entrada). El nuevo intervalo es `easeMillis * factor(nota)` acotado; el
 * `dueMs` resultante es `nowMs + nuevoIntervalo`. Una nota 0 reinicia al
 * intervalo minimo (repasar pronto); notas altas alargan el intervalo. Puro y
 * determinista.
 */
export const reviewFlashcard = (
  card: Flashcard,
  grade: FlashcardGrade,
  nowMs: number,
): Flashcard => {
  const base = card.easeMillis > 0 ? card.easeMillis : FLASHCARD_MIN_EASE_MS;
  const nextEase = clampEase(Math.round(base * gradeMultiplier(grade)));
  return {
    id: card.id,
    easeMillis: nextEase,
    dueMs: nowMs + nextEase,
  };
};

/**
 * Devuelve las tarjetas cuyo `dueMs` ya vencio (`dueMs <= nowMs`), preservando
 * el orden de entrada. No muta el arreglo recibido. Puro y determinista.
 */
export const dueFlashcards = (
  cards: readonly Flashcard[],
  nowMs: number,
): readonly Flashcard[] => cards.filter((card) => card.dueMs <= nowMs);
