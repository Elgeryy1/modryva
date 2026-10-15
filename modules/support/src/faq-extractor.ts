/**
 * Extraccion de FAQ a partir de pares pregunta/respuesta validados por la
 * comunidad. Logica pura y determinista: no hace I/O, red ni acceso a reloj;
 * recibe pares planos y devuelve la seleccion ordenada. Se usa para construir
 * una seccion de "preguntas frecuentes" a partir de respuestas aprobadas y
 * votadas.
 */

/**
 * Par pregunta/respuesta candidato a entrar en la FAQ. `upvotes` es el numero
 * de votos positivos (se asume >= 0) y `approved` indica si un moderador lo
 * valido. Solo los pares aprobados y con votos suficientes llegan a la FAQ.
 */
export interface QaPair {
  readonly question: string;
  readonly answer: string;
  readonly upvotes: number;
  readonly approved: boolean;
}

/** Entrada final de la FAQ: solo pregunta y respuesta ya seleccionadas. */
export interface FaqEntry {
  readonly question: string;
  readonly answer: string;
}

/**
 * Normaliza una pregunta para deduplicar: recorta, colapsa espacios internos
 * y pasa a minusculas. Se usa solo como clave interna; el texto mostrado
 * conserva su forma original.
 */
const normalizeQuestion = (question: string): string =>
  question.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Extrae las entradas de FAQ a partir de los pares candidatos. Conserva solo
 * los pares aprobados con `upvotes >= minUpvotes`, los ordena por votos de
 * mayor a menor de forma estable (los empates mantienen el orden de entrada)
 * y deduplica por pregunta normalizada quedandose con la primera aparicion
 * tras el orden. Pura y determinista.
 */
export const extractFaq = (
  pairs: readonly QaPair[],
  minUpvotes: number,
): readonly FaqEntry[] => {
  const eligible = pairs
    .map((pair, index) => ({ pair, index }))
    .filter(({ pair }) => pair.approved && pair.upvotes >= minUpvotes);

  eligible.sort((a, b) => {
    if (b.pair.upvotes !== a.pair.upvotes) {
      return b.pair.upvotes - a.pair.upvotes;
    }
    return a.index - b.index;
  });

  const seen = new Set<string>();
  const entries: FaqEntry[] = [];

  for (const { pair } of eligible) {
    const key = normalizeQuestion(pair.question);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    entries.push({ question: pair.question, answer: pair.answer });
  }

  return entries;
};
