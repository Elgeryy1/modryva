/**
 * Result of a signature-spam scan over a user's recent messages.
 * `signature` holds the normalized repeated line when spam is detected,
 * or undefined otherwise. Pure and deterministic.
 */
export interface SignatureSpamResult {
  readonly matched: boolean;
  readonly signature: string | undefined;
  readonly occurrences: number;
}

/**
 * Tuning options for detectSignatureSpam.
 * `minOccurrences` is the inclusive threshold of repeated signatures required
 * to flag spam (default 3). Pure and deterministic.
 */
export interface SignatureSpamOptions {
  readonly minOccurrences?: number;
}

/** Substrings that mark a line as promotional: mention, link, t.me or the word "canal". */
const PROMO_HINTS: readonly string[] = ["@", "http", "t.me", "canal"];

/** Default inclusive threshold of repeated signatures required to flag spam. */
const DEFAULT_MIN_OCCURRENCES = 3;

/**
 * Returns the last non-empty (trimmed) line of a message, or undefined when the
 * message has no printable line. Pure and deterministic.
 */
const lastNonEmptyLine = (message: string): string | undefined => {
  const lines = message.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const trimmed = (lines[i] ?? "").trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return undefined;
};

/**
 * Normalizes a signature line for comparison: trims, collapses internal
 * whitespace to single spaces and lowercases. Pure and deterministic.
 */
const normalizeSignature = (line: string): string =>
  line.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Detects signature spam: a user who ends most messages with the same
 * promotional line or channel. Takes the last non-empty line of each message,
 * normalizes it, counts the most frequent one, and flags spam when that count
 * reaches minOccurrences AND the line carries a promotional hint (mention,
 * link, t.me or the word "canal"). Frequency ties are broken by first
 * appearance so the result is stable regardless of insertion churn. Returns
 * signature undefined and occurrences 0 when nothing is flagged.
 * Pure and deterministic.
 */
export const detectSignatureSpam = (
  messages: readonly string[],
  options?: SignatureSpamOptions,
): SignatureSpamResult => {
  const minOccurrences = options?.minOccurrences ?? DEFAULT_MIN_OCCURRENCES;
  const counts = new Map<string, number>();
  for (const message of messages) {
    const line = lastNonEmptyLine(message);
    if (line === undefined) {
      continue;
    }
    const signature = normalizeSignature(line);
    if (signature.length === 0) {
      continue;
    }
    counts.set(signature, (counts.get(signature) ?? 0) + 1);
  }

  let topSignature: string | undefined;
  let topCount = 0;
  for (const [signature, count] of counts) {
    if (count > topCount) {
      topCount = count;
      topSignature = signature;
    }
  }

  if (topSignature === undefined || topCount < minOccurrences) {
    return { matched: false, signature: undefined, occurrences: 0 };
  }
  const signature = topSignature;
  const promotional = PROMO_HINTS.some((hint) => signature.includes(hint));
  if (!promotional) {
    return { matched: false, signature: undefined, occurrences: 0 };
  }
  return { matched: true, signature, occurrences: topCount };
};
