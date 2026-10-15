/**
 * Result of scanning a message for camouflaged or obfuscated links.
 * `reasons` is deduplicated and kept in a fixed curated order.
 * Pure and deterministic.
 */
export interface CamouflagedLinkSignal {
  readonly matched: boolean;
  readonly reasons: readonly string[];
}

/**
 * Unicode dot look-alikes commonly used to hide a domain's real dots
 * (e.g. "banco。com" instead of "banco.com").
 * Pure and deterministic.
 */
const RARE_DOTS: readonly string[] = [
  "。", // ideographic full stop
  "．", // fullwidth full stop
  "․", // one dot leader
  "·", // middle dot
  "‧", // hyphenation point
  "｡", // halfwidth ideographic full stop
];

/**
 * Known URL shorteners, matched with word boundaries so substrings of
 * legit domains (e.g. "part.com" containing "t.co") do NOT trigger.
 * Pure and deterministic.
 */
const SHORTENER_PATTERNS: readonly RegExp[] = [
  /\bbit\.ly\b/i,
  /\btinyurl\b/i,
  /\bt\.co\b/i,
  /\bgoo\.gl\b/i,
  /\bow\.ly\b/i,
  /\bis\.gd\b/i,
  /\bcutt\.ly\b/i,
  /\brebrand\.ly\b/i,
];

/**
 * A dot flanked by alphanumerics with whitespace on at least one side,
 * e.g. "ejemplo . com" or "ejemplo. com" or "ejemplo .com".
 * Pure and deterministic.
 */
const SPACED_DOT = /[a-z0-9](?:[ \t]+\.[ \t]*|[ \t]*\.[ \t]+)[a-z0-9]/i;

/**
 * An http(s) link that embeds an @ before the real host, the classic
 * phishing trick (e.g. "http://banco.com@evil.io").
 * Pure and deterministic.
 */
const AT_IN_URL = /https?:\/\/\S*@/i;

/**
 * Detects links camouflaged to dodge naive URL filters: dots split by
 * spaces, unicode dot look-alikes, known URL shorteners, or an @ hidden
 * inside an http(s) URL. Reasons are deduplicated and returned in the
 * fixed order: "espacios", "punto_raro", "acortador", "arroba_url".
 * Empty result for undefined, empty or clean text.
 * Pure and deterministic.
 */
export const detectCamouflagedLink = (
  text: string | undefined,
): CamouflagedLinkSignal => {
  if (!text) {
    return { matched: false, reasons: [] };
  }
  const reasons: string[] = [];
  if (SPACED_DOT.test(text)) {
    reasons.push("espacios");
  }
  if (RARE_DOTS.some((dot) => text.includes(dot))) {
    reasons.push("punto_raro");
  }
  if (SHORTENER_PATTERNS.some((pattern) => pattern.test(text))) {
    reasons.push("acortador");
  }
  if (AT_IN_URL.test(text)) {
    reasons.push("arroba_url");
  }
  return { matched: reasons.length > 0, reasons };
};
