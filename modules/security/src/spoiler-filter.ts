/**
 * Result of scanning a message for spoiler content: whether any spoiler
 * term matched, plus the ordered, deduplicated list of terms that hit.
 * Pure and deterministic.
 */
export interface SpoilerSignal {
  readonly matched: boolean;
  readonly hits: readonly string[];
}

/**
 * Built-in generic spoiler markers checked on every scan, independent of the
 * caller-provided keywords. Stored lowercase for case-insensitive matching.
 * Pure and deterministic.
 */
export const SPOILER_MARKERS: readonly string[] = [
  "spoiler",
  "muere",
  "final de",
  "el asesino es",
  "temporada final",
];

/**
 * Scans text for spoiler content, combining SPOILER_MARKERS with the
 * caller-provided keywords. Matching is case-insensitive via substring test.
 * Hits are deduplicated and ordered markers-first (in SPOILER_MARKERS order),
 * then keywords in input order. Keywords are trimmed and lowercased; empty or
 * whitespace-only keywords are ignored so they cannot match every message.
 * Undefined or empty text yields no match.
 * Pure and deterministic.
 */
export const detectSpoiler = (
  text: string | undefined,
  keywords: readonly string[],
): SpoilerSignal => {
  if (!text) {
    return { matched: false, hits: [] };
  }
  const lower = text.toLowerCase();
  const terms: string[] = [...SPOILER_MARKERS];
  for (const keyword of keywords) {
    const normalized = keyword.trim().toLowerCase();
    if (normalized.length > 0 && !terms.includes(normalized)) {
      terms.push(normalized);
    }
  }
  const hits: string[] = [];
  for (const term of terms) {
    if (lower.includes(term) && !hits.includes(term)) {
      hits.push(term);
    }
  }
  return { matched: hits.length > 0, hits };
};
