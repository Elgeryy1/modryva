/**
 * Text-only detector for social-manipulation cues in a message: bandwagon and
 * peer-pressure framings such as "todos pensamos que", "todo el mundo sabe",
 * "nadie te va a apoyar", "es obvio para todos" or "cualquiera con dos dedos de
 * frente". These pressure a person by invoking an alleged consensus or by
 * isolating them. The module inspects only the message text and reports which
 * known phrases appear so a moderation engine can weigh them. No I/O, no clock,
 * no randomness. Pure and deterministic.
 */

/**
 * Result of scanning a message. `matched` is true when at least one known
 * manipulation phrase is present; `phrases` lists the matched phrases in
 * SOCIAL_MANIPULATION_PATTERNS order, deduplicated. Pure and deterministic.
 */
export interface SocialManipulationSignal {
  readonly matched: boolean;
  readonly phrases: readonly string[];
}

/**
 * Known manipulation phrases, stored lowercase and without accents so they can
 * be matched against normalized input. The array order is the canonical output
 * order of `detectSocialManipulation`. Pure and deterministic.
 */
export const SOCIAL_MANIPULATION_PATTERNS: readonly string[] = [
  "todos pensamos que",
  "todo el mundo sabe",
  "todo el mundo piensa",
  "todos estan de acuerdo",
  "nadie te va a apoyar",
  "nadie te va a creer",
  "es obvio para todos",
  "cualquiera con dos dedos de frente",
];

/**
 * Normalizes text for matching: lowercases, strips diacritics (accents), and
 * collapses any run of whitespace to a single space. Leaves flat text ready for
 * plain substring search against the patterns. Pure and deterministic.
 */
const normalize = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Detects social-manipulation phrases in a message, case- and accent-
 * insensitive. Returns the matched phrases in SOCIAL_MANIPULATION_PATTERNS
 * order (never text order), deduplicated. Empty result for undefined, empty or
 * whitespace-only text. Pure and deterministic.
 */
export const detectSocialManipulation = (
  text: string | undefined,
): SocialManipulationSignal => {
  if (!text) {
    return { matched: false, phrases: [] };
  }
  const normalized = normalize(text);
  if (normalized.length === 0) {
    return { matched: false, phrases: [] };
  }
  const phrases: string[] = [];
  for (const pattern of SOCIAL_MANIPULATION_PATTERNS) {
    if (normalized.includes(pattern) && !phrases.includes(pattern)) {
      phrases.push(pattern);
    }
  }
  return { matched: phrases.length > 0, phrases };
};
