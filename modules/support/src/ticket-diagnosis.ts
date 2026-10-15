/**
 * Guided support diagnosis template (F5/AC). A fixed, ordered checklist of the
 * data points a user must supply before an agent can triage a ticket:
 * operating system, app version, the exact error, and a screenshot. Pure and
 * deterministic: no I/O, no clock, no randomness. Callers pass a plain
 * `provided` map (fieldId -> true when the user already gave that datum) and
 * this module reports what is still missing and whether the flow is complete.
 */

/** Identifier of a single diagnosis step. */
export type DiagnosisStepId = "sistema" | "version" | "error" | "captura";

/** A single guided step: a stable id plus the user-facing question. */
export interface DiagnosisStep {
  readonly id: DiagnosisStepId;
  readonly question: string;
}

/**
 * The ordered diagnosis checklist. Order is significant: it drives
 * `nextDiagnosisStep` and the order of `missingDiagnosisFields`. Questions are
 * user-facing (shown in chat) and therefore carry correct accents.
 */
export const DIAGNOSIS_STEPS: readonly DiagnosisStep[] = [
  {
    id: "sistema",
    question: "¿Qué sistema operativo usas (Android, iOS, Windows)?",
  },
  {
    id: "version",
    question: "¿Qué versión de la aplicación tienes instalada?",
  },
  {
    id: "error",
    question: "¿Qué error exacto ves? Copia el mensaje si puedes.",
  },
  {
    id: "captura",
    question: "¿Puedes adjuntar una captura de pantalla del problema?",
  },
];

/**
 * Returns the id of the step that follows `id` in the checklist, or null when
 * `id` is the last step or is not a known step id. Pure and deterministic.
 */
export const nextDiagnosisStep = (id: string): DiagnosisStepId | null => {
  const index = DIAGNOSIS_STEPS.findIndex((step) => step.id === id);
  if (index < 0) {
    return null;
  }
  const next = DIAGNOSIS_STEPS[index + 1];
  return next !== undefined ? next.id : null;
};

/**
 * Returns the ids of the steps still missing from `provided`, in checklist
 * order. A field counts as provided only when its entry is strictly `true`;
 * missing keys, `false` and any other value count as not provided. Pure and
 * deterministic.
 */
export const missingDiagnosisFields = (
  provided: Record<string, boolean>,
): readonly DiagnosisStepId[] =>
  DIAGNOSIS_STEPS.filter((step) => provided[step.id] !== true).map(
    (step) => step.id,
  );

/**
 * True when every diagnosis step has been provided (no missing fields). Pure
 * and deterministic.
 */
export const isDiagnosisComplete = (
  provided: Record<string, boolean>,
): boolean => missingDiagnosisFields(provided).length === 0;
