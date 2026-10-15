/**
 * Result of scanning a message for unreal financial promises. `phrases` holds
 * the canonical labels of every distinct pattern that matched, in a stable
 * order (curated phrases first in PROMISE_PATTERNS order, then the
 * "earn per period" pattern). `score` is the summed weight of those matches
 * and `matched` is true when at least one pattern fired.
 */
export interface UnrealPromiseSignal {
  readonly matched: boolean;
  readonly phrases: readonly string[];
  readonly score: number;
}

/** Internal shape of a curated promise pattern. */
interface PromisePattern {
  readonly label: string;
  readonly needle: string;
  readonly weight: number;
}

/**
 * Curated get-rich-quick phrases, checked as normalized substrings. `label` is
 * the user-facing Spanish form (with accents), `needle` is the accent-stripped
 * lowercase form used for matching, and `weight` feeds the risk score. Order
 * here defines the order matched labels are reported in.
 */
const PROMISE_PATTERNS: readonly PromisePattern[] = [
  { label: "dinero fácil", needle: "dinero facil", weight: 2 },
  {
    label: "inversión garantizada",
    needle: "inversion garantizada",
    weight: 3,
  },
  { label: "duplica tu dinero", needle: "duplica tu dinero", weight: 3 },
  { label: "sin riesgo", needle: "sin riesgo", weight: 2 },
  { label: "ganancias aseguradas", needle: "ganancias aseguradas", weight: 3 },
];

/**
 * Matches an "earn <number> per <period>" claim such as "gana 100 al dia" or
 * "gana 500 a la semana", tolerating currency symbols and filler words while
 * refusing to cross sentence boundaries. Requires a digit, so a bare
 * "gana dinero al dia" (no amount) does not fire. Runs against normalized text.
 */
const EARN_PER_PERIOD =
  /\bgana\w*\b[^.!?]*?\d[\d.,]*[^.!?]*?\b(?:al dia|a la semana|al mes|por dia|por semana|por mes)\b/;

/** Canonical user-facing label reported when EARN_PER_PERIOD matches. */
const EARN_PER_PERIOD_LABEL = "gana X al día";

/** Weight added to the score when the earn-per-period pattern matches. */
const EARN_PER_PERIOD_WEIGHT = 2;

/** Strips diacritics so accented phrases match their plain ASCII forms. */
const stripAccents = (value: string): string =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Lowercases, removes accents, collapses whitespace and trims. */
const normalize = (value: string): string =>
  stripAccents(value.toLowerCase()).replace(/\s+/g, " ").trim();

/**
 * Scans a message for unreal financial promises, combining a curated phrase
 * list with an "earn <number> per <period>" regex. Matching is accent- and
 * case-insensitive; labels are de-duplicated and returned in a stable order
 * (curated phrases in PROMISE_PATTERNS order, then the earn-per-period label);
 * the score is the summed weight of the matched patterns. Returns an empty,
 * unmatched result for undefined, empty or clean text. Pure and deterministic.
 */
export const detectUnrealPromises = (
  text: string | undefined,
): UnrealPromiseSignal => {
  if (!text) {
    return { matched: false, phrases: [], score: 0 };
  }
  const normalized = normalize(text);
  const phrases: string[] = [];
  let score = 0;
  for (const pattern of PROMISE_PATTERNS) {
    if (normalized.includes(pattern.needle)) {
      phrases.push(pattern.label);
      score += pattern.weight;
    }
  }
  if (EARN_PER_PERIOD.test(normalized)) {
    phrases.push(EARN_PER_PERIOD_LABEL);
    score += EARN_PER_PERIOD_WEIGHT;
  }
  return { matched: phrases.length > 0, phrases, score };
};
