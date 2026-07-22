/**
 * Sanction and population counts for new and veteran members, used to spot a
 * bias toward punishing newcomers. Pure and deterministic.
 */
export interface OperationalBiasInput {
  readonly newSanctions: number;
  readonly newMembers: number;
  readonly veteranSanctions: number;
  readonly veteranMembers: number;
}

/**
 * Per-cohort sanction rates and whether an anti-newcomer bias is flagged.
 * Pure and deterministic.
 */
export interface OperationalBiasResult {
  readonly newRate: number;
  readonly veteranRate: number;
  readonly biased: boolean;
}

const roundRate = (value: number): number => Math.round(value * 100) / 100;

/**
 * Detects operational bias: compares the sanction rate for new members against
 * that for veterans (sanctions divided by members, rounded to 2 decimals). Flags
 * bias when the new-member rate is more than double the veteran rate.
 * Pure and deterministic.
 */
export const detectOperationalBias = (
  input: OperationalBiasInput,
): OperationalBiasResult => {
  const newRate =
    input.newMembers === 0
      ? 0
      : roundRate(input.newSanctions / input.newMembers);
  const veteranRate =
    input.veteranMembers === 0
      ? 0
      : roundRate(input.veteranSanctions / input.veteranMembers);
  return {
    newRate,
    veteranRate,
    biased: input.newMembers > 0 && newRate > veteranRate * 2,
  };
};
