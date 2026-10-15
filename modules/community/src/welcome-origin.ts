/**
 * A single origin-to-message rule: when a member joins through `link`,
 * they should receive `message` as their welcome.
 * Pure and deterministic.
 */
export interface WelcomeOriginRule {
  readonly link: string;
  readonly message: string;
}

/**
 * Optional settings for welcomeByOrigin. `fallback` overrides the default
 * generic Spanish welcome used when no rule matches.
 * Pure and deterministic.
 */
export interface WelcomeByOriginOptions {
  readonly fallback?: string;
}

/**
 * Default Spanish welcome shown when the invite link is unknown, empty
 * or missing. Uses correct accents and opening punctuation.
 */
const DEFAULT_WELCOME = "¡Te damos la bienvenida al grupo! 👋";

/**
 * Picks a welcome message based on the invite link the member used to join.
 * Compares the trimmed invite link against each rule's trimmed link and
 * returns the message of the FIRST matching rule, preserving `mapping` order.
 * Falls back to options.fallback (or a generic Spanish welcome) when the
 * link is undefined, empty, or has no matching rule.
 * Pure and deterministic.
 */
export const welcomeByOrigin = (
  inviteLink: string | undefined,
  mapping: readonly WelcomeOriginRule[],
  options?: WelcomeByOriginOptions,
): string => {
  const fallback = options?.fallback ?? DEFAULT_WELCOME;
  if (!inviteLink) {
    return fallback;
  }
  const target = inviteLink.trim();
  if (target.length === 0) {
    return fallback;
  }
  for (const rule of mapping) {
    if (rule.link.trim() === target) {
      return rule.message;
    }
  }
  return fallback;
};
