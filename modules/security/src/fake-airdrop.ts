/**
 * Result of scanning a message for fake-airdrop scam signals.
 * Pure and deterministic.
 */
export interface FakeAirdropSignal {
  /** True when at least one scam keyword was detected. */
  readonly matched: boolean;
  /** Matched keywords, deduplicated, in AIRDROP_TERMS order. */
  readonly hits: readonly string[];
  /** Number of distinct keywords matched (equals hits.length). */
  readonly score: number;
}

/**
 * Keyword catalog for the anti fake-airdrop mode, tuned for crypto and tech
 * groups. Order defines the reported hit order. Plain ASCII on purpose.
 */
const AIRDROP_TERMS: readonly string[] = [
  "airdrop",
  "claim",
  "conecta tu wallet",
  "reclama tokens",
  "sorteo de tokens",
  "free mint",
];

/**
 * Detects fake-airdrop scam keywords in a message, case-insensitive,
 * deduplicated, preserving AIRDROP_TERMS order. Returns an empty, unmatched
 * result for undefined or clean text. The score equals the number of distinct
 * keywords found.
 * Pure and deterministic.
 */
export const detectFakeAirdrop = (
  text: string | undefined,
): FakeAirdropSignal => {
  if (!text) {
    return { matched: false, hits: [], score: 0 };
  }
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const term of AIRDROP_TERMS) {
    if (lower.includes(term) && !hits.includes(term)) {
      hits.push(term);
    }
  }
  return { matched: hits.length > 0, hits, score: hits.length };
};
