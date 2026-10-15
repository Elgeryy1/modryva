/**
 * A member's tenure (days) and trust score, used to unlock link posting by
 * merit rather than payment. Pure and deterministic.
 */
export interface LinkUnlockInput {
  readonly tenureDays: number;
  readonly trustScore: number;
}

/** Options for canUnlockLinks. */
export interface LinkUnlockOptions {
  readonly minTenureDays?: number;
  readonly minTrustScore?: number;
}

/**
 * Whether the member may post links, with a user-facing Spanish reason.
 * Pure and deterministic.
 */
export interface LinkUnlockResult {
  readonly unlocked: boolean;
  readonly reason: string;
}

/**
 * Decides whether a member has earned the right to post links, requiring both a
 * minimum tenure (default 7 days) and a minimum trust score (default 50). By
 * merit, never by payment. Reasons are user-facing Spanish.
 * Pure and deterministic.
 */
export const canUnlockLinks = (
  input: LinkUnlockInput,
  options?: LinkUnlockOptions,
): LinkUnlockResult => {
  const minTenureDays = options?.minTenureDays ?? 7;
  const minTrustScore = options?.minTrustScore ?? 50;
  const unlocked =
    input.tenureDays >= minTenureDays && input.trustScore >= minTrustScore;
  return {
    unlocked,
    reason: unlocked
      ? "Puedes enviar enlaces: antigüedad y confianza suficientes."
      : "Aún no puedes enviar enlaces: necesitas más antigüedad o confianza.",
  };
};
