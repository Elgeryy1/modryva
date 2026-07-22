/**
 * Inputs describing who acts and who receives a moderation sanction, used to
 * decide whether a peer-admin review is mandatory.
 * Pure and deterministic.
 */
export interface PeerAdminReviewInput {
  /** Whether the actor issuing the sanction is an administrator. */
  readonly actorIsAdmin: boolean;
  /** Whether the target receiving the sanction is an administrator. */
  readonly targetIsAdmin: boolean;
}

/**
 * Result of evaluating a sanction for a mandatory peer-admin review.
 * Pure and deterministic.
 */
export interface PeerAdminReviewOutcome {
  /** True when a mandatory review is required (admin sanctions admin). */
  readonly required: boolean;
  /** User-facing Spanish explanation of the decision. */
  readonly reason: string;
}

/**
 * Decides whether a sanction requires a mandatory peer-admin review.
 * A review is required only when an administrator sanctions another
 * administrator. Every branch returns a user-facing Spanish reason.
 * Pure and deterministic.
 */
export const requiresPeerReview = (
  input: PeerAdminReviewInput,
): PeerAdminReviewOutcome => {
  const { actorIsAdmin, targetIsAdmin } = input;
  if (actorIsAdmin && targetIsAdmin) {
    return {
      required: true,
      reason:
        "⚠️ Un administrador sancionó a otro administrador. Se requiere revisión obligatoria antes de aplicar la medida.",
    };
  }
  if (!actorIsAdmin && targetIsAdmin) {
    return {
      required: false,
      reason:
        "El autor no es administrador, así que no aplica la revisión entre administradores.",
    };
  }
  if (actorIsAdmin && !targetIsAdmin) {
    return {
      required: false,
      reason:
        "La sanción recae sobre un usuario normal; no hace falta revisión entre pares.",
    };
  }
  return {
    required: false,
    reason:
      "Ni el autor ni el objetivo son administradores; no aplica revisión obligatoria.",
  };
};
