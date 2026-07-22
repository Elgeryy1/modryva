/** A message in a thread being scanned for a joke turning into insults. */
export interface JokeEscalationMessage {
  readonly text: string;
}

/**
 * Result of scanning a thread: whether a joke escalated into insults and the
 * indices of the first joke and the first following insult (-1 when absent).
 * Pure and deterministic.
 */
export interface JokeEscalationResult {
  readonly escalating: boolean;
  readonly jokeIndex: number;
  readonly insultIndex: number;
}

const JOKE_MARKERS: readonly string[] = [
  "jaja",
  "broma",
  "es cona",
  "modo broma",
  "era joke",
];

const INSULT_MARKERS: readonly string[] = [
  "idiota",
  "tonto",
  "imbecil",
  "estupido",
  "payaso",
  "inutil",
];

/** Lowercases and strips diacritics for accent-insensitive matching. */
const foldJokeText = (value: string): string =>
  value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Detects a joke that escalated into insults: finds the first message carrying
 * a joke marker, then the first later message carrying an insult marker.
 * Matching is case- and accent-insensitive. Pure and deterministic.
 */
export const detectJokeEscalation = (
  messages: readonly JokeEscalationMessage[],
): JokeEscalationResult => {
  let jokeIndex = -1;
  let insultIndex = -1;
  for (let index = 0; index < messages.length; index += 1) {
    const text = foldJokeText(messages[index]?.text ?? "");
    if (
      jokeIndex === -1 &&
      JOKE_MARKERS.some((marker) => text.includes(foldJokeText(marker)))
    ) {
      jokeIndex = index;
    }
    if (
      jokeIndex !== -1 &&
      index > jokeIndex &&
      insultIndex === -1 &&
      INSULT_MARKERS.some((marker) => text.includes(foldJokeText(marker)))
    ) {
      insultIndex = index;
    }
  }
  return {
    escalating: jokeIndex !== -1 && insultIndex !== -1,
    jokeIndex,
    insultIndex,
  };
};
