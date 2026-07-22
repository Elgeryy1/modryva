/**
 * Auto-revisable sanctions: a moderation sanction that a group agrees to
 * re-examine after X days. This is pure decision logic only — the service
 * feeds it plain timestamps (no Date.now(), no I/O) and acts on the verdict.
 *
 * Two independent clocks live on a sanction:
 *  - `reviewAfterMs`: how long after it was applied a human/auto review is due.
 *  - `durationMs` (optional): how long the sanction itself lasts (e.g. a temp
 *    mute). When it has elapsed the sanction is simply expired.
 * A reverted sanction is inert: nothing is ever due on it again.
 */

/**
 * A sanction whose lifecycle can be decided purely from timestamps.
 * `appliedMs` is the epoch time (ms) at which it was applied; callers provide
 * it so this module stays deterministic.
 */
export interface ReviewableSanction {
  /** Epoch ms at which the sanction was applied. */
  readonly appliedMs: number;
  /** Optional lifetime of the sanction in ms; omit for a permanent sanction. */
  readonly durationMs?: number;
  /** Delay in ms after `appliedMs` at which a review becomes due. */
  readonly reviewAfterMs: number;
  /** True once the sanction has been lifted; makes it inert. */
  readonly reverted: boolean;
}

/** The action a caller should take after evaluating a sanction. */
export type SanctionReviewAction = "reopen" | "expire" | "none";

/** Outcome of {@link decideSanctionReview}: what to do and a human reason. */
export interface SanctionReviewDecision {
  readonly action: SanctionReviewAction;
  readonly reason: string;
}

/**
 * Epoch ms at which the sanction's own lifetime ends, or null when it is
 * permanent (no `durationMs`). Pure and deterministic.
 */
export const sanctionExpiresAtMs = (s: ReviewableSanction): number | null =>
  s.durationMs === undefined ? null : s.appliedMs + s.durationMs;

/**
 * Epoch ms at which a review becomes due, or null when the sanction is already
 * reverted (nothing will ever be due again). Pure and deterministic.
 */
export const nextReviewAtMs = (s: ReviewableSanction): number | null =>
  s.reverted ? null : s.appliedMs + s.reviewAfterMs;

/**
 * Decides what to do with a sanction at `nowMs`:
 *  - `"expire"` when it has a `durationMs` that has already elapsed
 *    (`nowMs >= appliedMs + durationMs`). Expiry takes precedence over reopen:
 *    a sanction that has lived out its term needs no review.
 *  - `"reopen"` when it is not reverted, not expired, and its review is due
 *    (`nowMs >= appliedMs + reviewAfterMs`).
 *  - `"none"` otherwise (still active and not yet due, or reverted).
 *
 * A reverted sanction always yields `"none"`. Pure and deterministic.
 */
export const decideSanctionReview = (
  s: ReviewableSanction,
  nowMs: number,
): SanctionReviewDecision => {
  if (s.reverted) {
    return { action: "none", reason: "Sancion ya revertida; sin accion." };
  }

  const expiresAtMs = sanctionExpiresAtMs(s);
  if (expiresAtMs !== null && nowMs >= expiresAtMs) {
    return { action: "expire", reason: "Duracion de la sancion cumplida." };
  }

  const reviewAtMs = s.appliedMs + s.reviewAfterMs;
  if (nowMs >= reviewAtMs) {
    return { action: "reopen", reason: "Revision automatica pendiente." };
  }

  return { action: "none", reason: "Sancion activa; revision no vencida." };
};
