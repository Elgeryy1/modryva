/**
 * Sensitivity level assigned to a moderation or support case.
 * "normal" has no risk factors, "privado" involves personal data,
 * "delicado" involves a minor, and "legal" involves a legal threat.
 * Pure and deterministic.
 */
export type CaseSensitivityLevel = "normal" | "privado" | "delicado" | "legal";

/**
 * Risk factors describing a case. Every factor is an explicit boolean so the
 * classification never depends on ambient state.
 * Pure and deterministic.
 */
export interface CaseSensitivityInput {
  readonly hasPersonalData: boolean;
  readonly involvesMinor: boolean;
  readonly legalThreat: boolean;
}

/**
 * Result of classifying a case: the chosen level plus a user-facing Spanish
 * reason explaining why that level was assigned.
 * Pure and deterministic.
 */
export interface CaseSensitivityAssessment {
  readonly level: CaseSensitivityLevel;
  readonly reason: string;
}

/**
 * Classifies a case into a sensitivity level using a strict priority:
 * legal > delicado (menor) > privado (datos personales) > normal.
 * Only the highest matching factor determines the level and reason.
 * Pure and deterministic.
 */
export const classifyCaseSensitivity = (
  input: CaseSensitivityInput,
): CaseSensitivityAssessment => {
  if (input.legalThreat) {
    return {
      level: "legal",
      reason:
        "Caso legal: hay una amenaza legal que requiere revisión jurídica. ⚖️",
    };
  }
  if (input.involvesMinor) {
    return {
      level: "delicado",
      reason: "Caso delicado: involucra a un menor de edad. 🚸",
    };
  }
  if (input.hasPersonalData) {
    return {
      level: "privado",
      reason: "Caso privado: contiene datos personales del usuario. 🔒",
    };
  }
  return {
    level: "normal",
    reason: "Caso normal: sin factores de sensibilidad. ✅",
  };
};
