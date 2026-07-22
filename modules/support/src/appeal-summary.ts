/**
 * Structured input describing a user appeal for the staff summary.
 * Pure and deterministic.
 */
export interface AppealSummaryInput {
  /** Appeal category label as chosen by the user (may be blank). */
  readonly category: string;
  /** Length of the appeal text in characters (0 or negative means empty). */
  readonly length: number;
  /** Whether the appeal attaches supporting evidence. */
  readonly hasEvidence: boolean;
}

const SHORT_MAX = 140;
const MEDIUM_MAX = 500;

/**
 * Maps a character count to a Spanish descriptor of the appeal body.
 * Not exported to avoid barrel symbol clashes. Pure and deterministic.
 */
const describeAppealLength = (length: number): string => {
  if (length <= 0) {
    return "sin contenido";
  }
  if (length <= SHORT_MAX) {
    return "breve";
  }
  if (length <= MEDIUM_MAX) {
    return "de longitud media";
  }
  return "extensa";
};

/**
 * Derives a triage priority label from body length and evidence presence.
 * Not exported to avoid barrel symbol clashes. Pure and deterministic.
 */
const deriveAppealPriority = (length: number, hasEvidence: boolean): string => {
  if (hasEvidence && length > SHORT_MAX) {
    return "alta";
  }
  if (hasEvidence || length > SHORT_MAX) {
    return "media";
  }
  return "baja";
};

/**
 * Builds a single Spanish line summarizing an appeal for staff triage,
 * covering category, body size, evidence presence and derived priority.
 * A blank category falls back to a neutral label. Pure and deterministic.
 */
export const summarizeAppealForStaff = (input: AppealSummaryInput): string => {
  const category = input.category.trim();
  const categoryLabel = category.length > 0 ? category : "sin categoría";
  const lengthLabel = describeAppealLength(input.length);
  const evidenceLabel = input.hasEvidence ? "con pruebas" : "sin pruebas";
  const priority = deriveAppealPriority(input.length, input.hasEvidence);
  return `📋 Apelación [${categoryLabel}] — descripción ${lengthLabel}, ${evidenceLabel}. Prioridad: ${priority}.`;
};
