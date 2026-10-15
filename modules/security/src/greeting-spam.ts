/**
 * One chat message considered by the greeting-spam heuristic. Pure and deterministic.
 */
export interface GreetingSpamMessage {
  /** Raw text of the message as sent by the user. */
  readonly text: string;
  /** Whether the message contains at least one link/URL. */
  readonly hasLink: boolean;
}

/**
 * Result of scanning a message sequence for the greeting-then-link spam pattern.
 * Pure and deterministic.
 */
export interface GreetingSpamSignal {
  /** True when a bare greeting is followed later by a message carrying a link. */
  readonly matched: boolean;
  /** Index of the triggering bare greeting, or -1 when nothing matched. */
  readonly greetingIndex: number;
}

/** Bare greetings a spam bot commonly opens with, lowercased ASCII. Pure and deterministic. */
const GREETINGS: readonly string[] = ["hola", "buenas", "hey", "hi"];

/**
 * Normalizes a message to a bare word by lowercasing, trimming, and stripping
 * any leading/trailing non-letter characters (punctuation, spaces, emojis).
 * Pure and deterministic.
 */
const bareWord = (text: string): string =>
  text
    .trim()
    .toLowerCase()
    .replace(/^[^\p{L}]+/u, "")
    .replace(/[^\p{L}]+$/u, "");

/**
 * Detects the classic bot tactic of greeting first (a bare "hola"/"buenas"/"hey"/"hi"
 * with no link) and dropping a link in a later message. Returns the index of the
 * earliest such greeting that has any later message carrying a link, or -1.
 * Pure and deterministic.
 */
export const detectGreetingSpam = (
  messages: readonly GreetingSpamMessage[],
): GreetingSpamSignal => {
  for (let i = 0; i < messages.length; i += 1) {
    const current = messages[i];
    if (current === undefined || current.hasLink) {
      continue;
    }
    if (!GREETINGS.includes(bareWord(current.text))) {
      continue;
    }
    for (let j = i + 1; j < messages.length; j += 1) {
      const later = messages[j];
      if (later?.hasLink) {
        return { matched: true, greetingIndex: i };
      }
    }
  }
  return { matched: false, greetingIndex: -1 };
};
