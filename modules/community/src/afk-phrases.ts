/**
 * Detects "I'm off for a bit" in ordinary chat, so nobody has to know a command
 * exists. `/afk` still works; this is the path people actually use.
 *
 * The hard part is not recognising "brb" — it is NOT firing on the ninety-nine
 * other ways those words appear. "me voy a dormir" said about someone else, or
 * quoted, or asked as a question, must leave everyone unmarked. A false
 * positive here is worse than a miss: it silently tells the group that someone
 * left when they are still talking.
 *
 * Pure: no clock, no I/O.
 */

/** Opening phrases that mean "I am leaving now". Anchored to the START of the
 * message: mid-sentence matches are overwhelmingly about someone else
 * ("cuando dijo que se iba a dormir"). */
const LEAVING: readonly RegExp[] = [
  // brb / bbl, on their own or with a trailing reason.
  /^brb\b/u,
  /^bbl\b/u,
  /^ahora\s+(?:vuelvo|regreso)\b/u,
  /^(?:ya\s+)?vuelvo\s+(?:en|dentro)\b/u,
  /^(?:me\s+)?piro\b/u,
  /^me\s+(?:voy|marcho|largo|piro|pico)\b/u,
  /^(?:me\s+)?voy\s+a\s+\w/u,
  /^salgo\s+(?:un|a)\b/u,
  /^(?:vuelvo|regreso)\s+(?:luego|ahora|en\s+un|más\s+tarde|mas\s+tarde)\b/u,
  /^hasta\s+(?:luego|ahora|mañana|manana)\b/u,
  /^(?:me\s+)?desconecto\b/u,
  /^(?:buenas\s+noches|gn|good\s*night)\b/u,
];

/**
 * Phrases that look like leaving but are not. Checked BEFORE the openers, and
 * each one is a real way the words show up without anyone going anywhere.
 */
const NOT_LEAVING: readonly RegExp[] = [
  // A question about someone else, or about leaving at all.
  /^\s*[¿?]/u,
  /\?\s*$/u,
  // Talking about a third person: "se va a dormir", "va a dormir".
  /^(?:se|él|el|ella|ellos|ellas)\s+(?:va|van)\b/u,
  // Negation: "no me voy", "aún no me voy".
  /\bno\s+me\s+(?:voy|marcho|piro|desconecto)\b/u,
  // Future or conditional rather than now: "luego me voy", "si me voy".
  /^(?:luego|si|cuando|despues|después)\b/u,
  // Quoting somebody.
  /^["'«»]/u,
];

/** Words that open a reason but are not part of it. */
const REASON_LEAD = /^(?:a|al|para|que|,|:|-|—)\s*/u;

const MAX_REASON = 60;

export interface AfkPhrase {
  /** What they said they were going to do, trimmed, or undefined when the
   * message was a bare "brb" with nothing after it. */
  readonly reason: string | undefined;
}

/**
 * Returns the detected departure, or null when the message is not one.
 *
 * `isReply` matters: a reply is usually addressed AT someone, and "me voy a
 * dormir" as a reply is far more often a comment on their message than an
 * announcement. Callers pass it so the detector can stay strict there.
 */
export const detectAfkPhrase = (
  text: string,
  options: { readonly isReply?: boolean } = {},
): AfkPhrase | null => {
  const raw = text.trim();
  // A long message that happens to open with "me voy" is a story, not a
  // status. Real departures are short — "me voy a dormir que mañana madrugo"
  // is 34 characters, so 80 leaves generous room without swallowing prose.
  if (raw.length === 0 || raw.length > 80) {
    return null;
  }
  const normalized = raw
    .toLowerCase()
    // Strip accents so "adiós"/"adios" and "más"/"mas" behave the same.
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "");

  if (NOT_LEAVING.some((pattern) => pattern.test(normalized))) {
    return null;
  }
  // In a reply, only the unmistakable openers count — "brb" is never about
  // someone else, but "me voy a dormir" very often is.
  const patterns = options.isReply ? LEAVING.slice(0, 2) : LEAVING;
  const match = patterns.find((pattern) => pattern.test(normalized));
  if (!match) {
    return null;
  }

  // The reason is whatever follows the opener, taken from the ORIGINAL text so
  // it keeps its accents and capitals when shown back to the group.
  const consumed = normalized.match(match)?.[0]?.length ?? 0;
  // trim() BEFORE stripping the lead word: the slice starts with the space that
  // separated them, and REASON_LEAD is anchored, so "me voy| a dormir" would
  // otherwise keep its "a" and read "se ha ido a a dormir".
  const reason = raw
    .slice(consumed)
    .trim()
    .replace(REASON_LEAD, "")
    .trim()
    .slice(0, MAX_REASON)
    .trim();

  return { reason: reason.length > 1 ? reason : undefined };
};

/** "@ana se ha ido a dormir" / "@ana se ha ido" when no reason was given. */
export const buildAfkAwayNotice = (
  who: string,
  reason: string | undefined,
): string =>
  reason ? `💤 ${who} se ha ido a ${reason}` : `💤 ${who} se ha ido`;

/** "@ana ha vuelto después de 2h 3m". */
export const buildAfkReturnNotice = (who: string, duration: string): string =>
  `👋 ${who} ha vuelto después de ${duration}`;
