/**
 * Result of scanning a username for commercial or scam-like markers.
 * `hits` lists the matched markers in a stable, curated order (commercial
 * terms first in list order, then domain markers, then "money"); `score`
 * is a weighted total capped at SCORE_CAP. Pure and deterministic.
 */
export interface CommercialUsernameSignal {
  readonly matched: boolean;
  readonly hits: readonly string[];
  readonly score: number;
}

/**
 * Curated commercial substrings that frequently appear in promotional or
 * impersonation accounts. Matched case-insensitively as substrings, so a
 * term hits even when embedded in a longer word.
 */
const COMMERCIAL_TERMS: readonly string[] = [
  "promo",
  "deal",
  "cash",
  "support",
  "free",
  "bonus",
  "vip",
  "official",
  "giveaway",
];

/** Domain / link markers that hint a username is advertising a destination. */
const DOMAIN_MARKERS: readonly string[] = [".com", ".io", "t.me"];

/**
 * Detects an embedded money amount such as `$100`, `100usd` or `usd100`.
 * ASCII-only on purpose to keep the source free of accented characters.
 * The regex has no global flag, so `.test` is stateless and deterministic.
 */
const MONEY_PATTERN =
  /\$\s?\d|\d\s?(?:usd|eur|gbp|btc)|(?:usd|eur|gbp|btc)\s?\d/;

const TERM_WEIGHT = 1;
const DOMAIN_WEIGHT = 2;
const MONEY_WEIGHT = 2;
const SCORE_CAP = 10;

/** Synthetic hit label used when a money amount is detected. */
const MONEY_HIT = "money";

/**
 * Scans a Telegram username for commercial, promotional or scam-like
 * markers: curated substrings (promo, deal, cash, support, free, bonus,
 * vip, official, giveaway), embedded domains (.com, .io, t.me) and money
 * amounts. Matching is case-insensitive and substring-based. Hits are
 * returned in a stable order: commercial terms in COMMERCIAL_TERMS order,
 * then domain markers in DOMAIN_MARKERS order, then "money". The score is
 * a weighted sum (term=1, domain=2, money=2) capped at SCORE_CAP. Returns
 * an empty, unmatched signal for undefined or empty input.
 * Pure and deterministic.
 */
export const detectCommercialUsername = (
  username: string | undefined,
): CommercialUsernameSignal => {
  if (!username) {
    return { matched: false, hits: [], score: 0 };
  }
  const lower = username.toLowerCase();
  const hits: string[] = [];
  let score = 0;
  for (const term of COMMERCIAL_TERMS) {
    if (lower.includes(term) && !hits.includes(term)) {
      hits.push(term);
      score += TERM_WEIGHT;
    }
  }
  for (const marker of DOMAIN_MARKERS) {
    if (lower.includes(marker) && !hits.includes(marker)) {
      hits.push(marker);
      score += DOMAIN_WEIGHT;
    }
  }
  if (MONEY_PATTERN.test(lower)) {
    hits.push(MONEY_HIT);
    score += MONEY_WEIGHT;
  }
  const cappedScore = score > SCORE_CAP ? SCORE_CAP : score;
  return { matched: hits.length > 0, hits, score: cappedScore };
};
