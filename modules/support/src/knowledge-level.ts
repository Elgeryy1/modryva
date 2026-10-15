/** A member's quiz record used to classify their knowledge level. */
export interface KnowledgeLevelInput {
  readonly correctAnswers: number;
  readonly totalAnswers: number;
}

/**
 * A knowledge level ("principiante", "intermedio", "avanzado") and the success
 * ratio it was derived from. Pure and deterministic.
 */
export interface KnowledgeLevelResult {
  readonly level: "principiante" | "intermedio" | "avanzado";
  readonly ratio: number;
}

/**
 * Classifies a member's knowledge level from their answer record. The ratio is
 * correct/total rounded to 2 decimals (0 when no answers). Levels: avanzado
 * (>= 0.8), intermedio (>= 0.5), otherwise principiante.
 * Pure and deterministic.
 */
export const classifyKnowledgeLevel = (
  input: KnowledgeLevelInput,
): KnowledgeLevelResult => {
  const ratio =
    input.totalAnswers === 0
      ? 0
      : Math.round((input.correctAnswers / input.totalAnswers) * 100) / 100;
  const level =
    ratio >= 0.8 ? "avanzado" : ratio >= 0.5 ? "intermedio" : "principiante";
  return { level, ratio };
};
