/**
 * Possible escalation actions for a repeat offender.
 * - "avisar": still below the last-chance threshold, keep warning.
 * - "ultima_oportunidad": one warning away from a ban, final warning.
 * - "banear": reached or exceeded the threshold, proceed to ban.
 * Pure and deterministic.
 */
export type LastChanceAction = "avisar" | "ultima_oportunidad" | "banear";

/**
 * Input for the last-chance decision.
 * - warnCount: number of warnings the offender already accumulated.
 * - threshold: number of warnings that triggers a ban.
 * Non-integer or negative values are normalized internally.
 * Pure and deterministic.
 */
export interface LastChanceInput {
  readonly warnCount: number;
  readonly threshold: number;
}

/**
 * Result of the last-chance decision: the chosen action plus a
 * user-facing Spanish message intended for the offender/admins.
 * Pure and deterministic.
 */
export interface LastChanceDecision {
  readonly action: LastChanceAction;
  readonly message: string;
}

/**
 * Normalizes a value into a non-negative integer, using the provided
 * minimum as a floor. Non-finite values collapse to the minimum.
 * Pure and deterministic.
 */
const normalize = (value: number, min: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }
  const floored = Math.floor(value);
  return floored < min ? min : floored;
};

/**
 * Decides how to escalate a repeat offender based on accumulated
 * warnings and the configured ban threshold.
 *
 * Semantics (with a normalized threshold t >= 1 and warnings w >= 0):
 * - w >= t                -> "banear"
 * - w === t - 1           -> "ultima_oportunidad"
 * - w <  t - 1            -> "avisar"
 *
 * Pure and deterministic.
 */
export const decideLastChance = (
  input: LastChanceInput,
): LastChanceDecision => {
  const threshold = normalize(input.threshold, 1);
  const warnCount = normalize(input.warnCount, 0);

  if (warnCount >= threshold) {
    return {
      action: "banear",
      message: `⛔ Has alcanzado el límite de ${threshold} avisos. Procede la expulsión del grupo.`,
    };
  }

  if (warnCount === threshold - 1) {
    return {
      action: "ultima_oportunidad",
      message: `🚨 Última oportunidad: llevas ${warnCount} de ${threshold} avisos. Un aviso más y serás expulsado.`,
    };
  }

  const remaining = threshold - warnCount;
  return {
    action: "avisar",
    message: `⚠️ Llevas ${warnCount} de ${threshold} avisos. Te quedan ${remaining} antes de la expulsión.`,
  };
};
