/**
 * Format reputation of a message: a pure, deterministic heuristic that scores
 * how "clean" a message reads based purely on its surface form — not its
 * meaning. It penalizes shouting (excess UPPERCASE), emoji spam (too many or
 * long identical runs), symbol noise, and spammy calls to action such as
 * "compra ya" / "click aqui". The result is 0..100 where 100 means perfectly
 * clean. No I/O, no clock, no randomness: same text in, same result out.
 */

const LETTER_UPPER = /\p{Lu}/u;
const LETTER_LOWER = /\p{Ll}/u;
const EMOJI = /\p{Extended_Pictographic}/u;
const WHITESPACE = /\s/u;
const SYMBOL = /[!?¡¿@#$%^&*_=+~|<>]/u;
const DIACRITIC = /\p{Diacritic}/gu;

/** Fraction of cased letters that must be uppercase before shouting counts. */
export const FORMAT_REPUTATION_UPPERCASE_THRESHOLD = 0.6;

/** Minimum count of cased letters before uppercase ratio is judged at all. */
export const FORMAT_REPUTATION_MIN_CASED = 8;

/** Emoji count (inclusive) at which "too many emojis" starts penalizing. */
export const FORMAT_REPUTATION_EMOJI_COUNT_THRESHOLD = 6;

/** Length of an identical-emoji run (inclusive) that counts as repeated. */
export const FORMAT_REPUTATION_EMOJI_RUN_THRESHOLD = 3;

/** Fraction of non-space chars that may be symbols before it counts. */
export const FORMAT_REPUTATION_SYMBOL_THRESHOLD = 0.15;

/** Length of an identical-symbol run (inclusive) that counts as repeated. */
export const FORMAT_REPUTATION_PUNCT_RUN_THRESHOLD = 3;

/**
 * Spammy calls to action, stored lowercased and accent-free so matching can
 * normalize the input the same way. Extend with care: order is irrelevant to
 * the score (matches are de-duplicated by inclusion).
 */
export const FORMAT_REPUTATION_CTA_PHRASES: readonly string[] = [
  "compra ya",
  "compra ahora",
  "click aqui",
  "clic aqui",
  "haz click",
  "haz clic",
  "pincha aqui",
  "entra aqui",
  "gana dinero",
  "dinero facil",
  "oferta limitada",
  "ultimas plazas",
  "plazas limitadas",
  "suscribete ya",
  "unete ya",
  "gratis ahora",
  "100% gratis",
  "escribeme ya",
];

/** Outcome of scoring a message's format reputation. */
export interface FormatReputationResult {
  /** 0..100 integer; 100 = clean, 0 = maximally spammy in form. */
  readonly score: number;
  /** User-facing Spanish reasons for every penalty applied, in fixed order. */
  readonly issues: readonly string[];
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

interface FormScan {
  readonly upper: number;
  readonly lower: number;
  readonly emojiCount: number;
  readonly maxEmojiRun: number;
  readonly symbolCount: number;
  readonly nonSpace: number;
  readonly maxPunctRun: number;
}

/**
 * Single pass over the codepoints gathering every surface statistic the score
 * needs. Runs are counted per-codepoint, which is deterministic and good
 * enough for shouting/emoji/symbol spam.
 */
const scanForm = (text: string): FormScan => {
  let upper = 0;
  let lower = 0;
  let emojiCount = 0;
  let maxEmojiRun = 0;
  let symbolCount = 0;
  let nonSpace = 0;
  let maxPunctRun = 0;

  let prevEmoji = "";
  let emojiRun = 0;
  let prevPunct = "";
  let punctRun = 0;

  for (const ch of text) {
    if (LETTER_UPPER.test(ch)) {
      upper += 1;
    } else if (LETTER_LOWER.test(ch)) {
      lower += 1;
    }

    if (!WHITESPACE.test(ch)) {
      nonSpace += 1;
    }

    if (EMOJI.test(ch)) {
      emojiCount += 1;
      if (ch === prevEmoji) {
        emojiRun += 1;
      } else {
        prevEmoji = ch;
        emojiRun = 1;
      }
      if (emojiRun > maxEmojiRun) {
        maxEmojiRun = emojiRun;
      }
    } else {
      prevEmoji = "";
      emojiRun = 0;
    }

    if (SYMBOL.test(ch)) {
      symbolCount += 1;
      if (ch === prevPunct) {
        punctRun += 1;
      } else {
        prevPunct = ch;
        punctRun = 1;
      }
      if (punctRun > maxPunctRun) {
        maxPunctRun = punctRun;
      }
    } else {
      prevPunct = "";
      punctRun = 0;
    }
  }

  return {
    upper,
    lower,
    emojiCount,
    maxEmojiRun,
    symbolCount,
    nonSpace,
    maxPunctRun,
  };
};

/** Lowercases and strips diacritics so CTA matching is accent-insensitive. */
const normalizeForCta = (text: string): string =>
  text.toLowerCase().normalize("NFD").replace(DIACRITIC, "");

/**
 * Returns the CTA phrases present in the text, in the order they are declared
 * in FORMAT_REPUTATION_CTA_PHRASES, without duplicates. Pure and deterministic.
 */
export const findFormatReputationCtas = (text: string): readonly string[] => {
  const normalized = normalizeForCta(text);
  const matched: string[] = [];
  for (const phrase of FORMAT_REPUTATION_CTA_PHRASES) {
    if (normalized.includes(phrase)) {
      matched.push(phrase);
    }
  }
  return matched;
};

/**
 * Scores the format reputation of a message. Starts at 100 and subtracts
 * bounded penalties for shouting, emoji spam, symbol noise and spammy CTAs.
 * Empty or clean text scores 100 with no issues. Pure and deterministic.
 */
export const scoreFormatReputation = (text: string): FormatReputationResult => {
  const scan = scanForm(text);
  const issues: string[] = [];
  let penalty = 0;

  const cased = scan.upper + scan.lower;
  if (cased >= FORMAT_REPUTATION_MIN_CASED) {
    const upperRatio = scan.upper / cased;
    if (upperRatio > FORMAT_REPUTATION_UPPERCASE_THRESHOLD) {
      penalty += clamp(
        Math.round((upperRatio - FORMAT_REPUTATION_UPPERCASE_THRESHOLD) * 100),
        0,
        35,
      );
      issues.push("Exceso de mayúsculas");
    }
  }

  if (scan.emojiCount >= FORMAT_REPUTATION_EMOJI_COUNT_THRESHOLD) {
    penalty += clamp(
      (scan.emojiCount - (FORMAT_REPUTATION_EMOJI_COUNT_THRESHOLD - 1)) * 4,
      0,
      25,
    );
    issues.push("Demasiados emojis");
  }

  if (scan.maxEmojiRun >= FORMAT_REPUTATION_EMOJI_RUN_THRESHOLD) {
    penalty += clamp((scan.maxEmojiRun - 2) * 5, 0, 20);
    issues.push("Emojis repetidos");
  }

  if (scan.nonSpace > 0) {
    const symbolRatio = scan.symbolCount / scan.nonSpace;
    if (symbolRatio > FORMAT_REPUTATION_SYMBOL_THRESHOLD) {
      penalty += clamp(
        Math.round((symbolRatio - FORMAT_REPUTATION_SYMBOL_THRESHOLD) * 100),
        0,
        25,
      );
      issues.push("Exceso de símbolos");
    }
  }

  if (scan.maxPunctRun >= FORMAT_REPUTATION_PUNCT_RUN_THRESHOLD) {
    penalty += clamp((scan.maxPunctRun - 2) * 4, 0, 15);
    issues.push("Puntuación repetida");
  }

  const ctas = findFormatReputationCtas(text);
  if (ctas.length > 0) {
    penalty += clamp(ctas.length * 12, 0, 36);
    issues.push("Llamadas a la acción de spam");
  }

  return { score: clamp(100 - penalty, 0, 100), issues };
};
