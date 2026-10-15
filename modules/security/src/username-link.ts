/**
 * Signal describing whether a username embeds a link, domain or brand marker.
 * `hits` lists the matched markers in LINK_MARKERS order, deduplicated.
 * Pure and deterministic.
 */
export interface UsernameLinkSignal {
  readonly matched: boolean;
  readonly hits: readonly string[];
}

/**
 * Suspicious markers commonly smuggled into usernames: raw URL schemes,
 * Telegram invite hosts and popular TLDs. Order defines the `hits` order.
 * Pure and deterministic.
 */
const LINK_MARKERS: readonly string[] = ["http", "t.me", ".com", ".io", ".xyz"];

/**
 * Detects whether a username hides a link, domain or brand marker such as
 * `.com`, `.io`, `.xyz`, `t.me` or an `http` scheme. Case-insensitive,
 * deduplicated, preserving LINK_MARKERS order. Empty result for undefined
 * or clean usernames.
 * Pure and deterministic.
 */
export const detectUsernameLink = (
  username: string | undefined,
): UsernameLinkSignal => {
  if (!username) {
    return { matched: false, hits: [] };
  }
  const lower = username.toLowerCase();
  const hits: string[] = [];
  for (const marker of LINK_MARKERS) {
    if (lower.includes(marker) && !hits.includes(marker)) {
      hits.push(marker);
    }
  }
  return { matched: hits.length > 0, hits };
};
