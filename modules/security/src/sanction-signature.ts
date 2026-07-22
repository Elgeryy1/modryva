/**
 * The parts that identify who applied a sanction, why, and to which case.
 * Pure and deterministic.
 */
export interface SanctionSignatureInput {
  readonly staff: string;
  readonly reason: string;
  readonly caseId: string;
}

/**
 * Builds a one-line, user-facing Spanish signature stamped on a sanction so
 * members and staff see who applied it, the motive and the case number.
 * Pure and deterministic.
 */
export const buildSanctionSignature = (input: SanctionSignatureInput): string =>
  `🛡️ Aplicado por ${input.staff} · Motivo: ${input.reason} · Caso #${input.caseId}`;
