/**
 * Input for the new-user link sandbox decision.
 * `isNewUser` marks accounts that recently joined and are not yet trusted.
 * `isFirstLink` marks the first message from that user that contains a link.
 * Pure and deterministic.
 */
export interface LinkSandboxInput {
  readonly isNewUser: boolean;
  readonly isFirstLink: boolean;
}

/**
 * Result of evaluating whether a link should be held for validation.
 * `hold` is true when the link must be withheld from the chat until an
 * admin validates it. `reason` is a user-facing Spanish explanation.
 * Pure and deterministic.
 */
export interface LinkSandboxDecision {
  readonly hold: boolean;
  readonly reason: string;
}

/** Shown when the first link of a brand-new user is sandboxed. Pure and deterministic. */
const HELD_REASON =
  "🔒 Modo sandbox: el primer enlace de un usuario nuevo queda retenido hasta que un administrador lo valide.";

/** Shown when the link can be published without validation. Pure and deterministic. */
const ALLOWED_REASON = "✅ El enlace se puede publicar sin validacion previa.";

/**
 * Decides whether a user's link should be held in the sandbox.
 * A link is held only when the author is a new user AND this is their
 * first link; any other combination is allowed through immediately.
 * Pure and deterministic.
 */
export const decideLinkSandbox = (
  input: LinkSandboxInput,
): LinkSandboxDecision => {
  const hold = input.isNewUser && input.isFirstLink;
  return {
    hold,
    reason: hold ? HELD_REASON : ALLOWED_REASON,
  };
};
