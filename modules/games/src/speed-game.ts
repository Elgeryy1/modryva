/**
 * Minijuego de velocidad: quien responde antes gana. Logica pura y
 * determinista para clasificar respuestas de un reto por tiempo de reaccion.
 * Sin I/O, sin Prisma, sin red, sin Date.now()/Math.random(): recibe entradas
 * planas y devuelve resultados reproducibles.
 */

/**
 * Una respuesta enviada por un participante. `ms` es el tiempo de reaccion en
 * milisegundos (menor es mas rapido); `correct` indica si acerto.
 */
export interface SpeedAnswer {
  readonly userId: string;
  readonly correct: boolean;
  readonly ms: number;
}

/** Entrada del ranking: solo el participante y su tiempo de reaccion. */
export interface SpeedRankEntry {
  readonly userId: string;
  readonly ms: number;
}

/**
 * Clasifica las respuestas correctas por tiempo de reaccion ascendente (mas
 * rapido primero). El orden es estable: ante empate de `ms` se conserva el
 * orden de aparicion en `answers`. Las respuestas incorrectas se descartan.
 * Pura y determinista.
 */
export const rankSpeedAnswers = (
  answers: readonly SpeedAnswer[],
): readonly SpeedRankEntry[] => {
  const correct: { readonly entry: SpeedRankEntry; readonly index: number }[] =
    [];

  for (let i = 0; i < answers.length; i += 1) {
    const answer = answers[i];
    if (answer?.correct) {
      correct.push({
        entry: { userId: answer.userId, ms: answer.ms },
        index: i,
      });
    }
  }

  correct.sort((a, b) =>
    a.entry.ms !== b.entry.ms ? a.entry.ms - b.entry.ms : a.index - b.index,
  );

  return correct.map((item) => item.entry);
};

/**
 * Devuelve el userId del ganador: la respuesta correcta mas rapida (con
 * desempate por orden de aparicion). Devuelve null cuando no hay ninguna
 * respuesta correcta. Pura y determinista.
 */
export const speedWinner = (answers: readonly SpeedAnswer[]): string | null => {
  const ranked = rankSpeedAnswers(answers);
  const first = ranked[0];
  return first !== undefined ? first.userId : null;
};
