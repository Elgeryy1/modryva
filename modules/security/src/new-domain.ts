/**
 * Result of inspecting a domain against a set of previously seen domains.
 * Pure and deterministic.
 */
export interface NewDomainSignal {
  /** True when the normalized domain has never been seen before. */
  readonly isNew: boolean;
  /** The normalized form of the input domain, or '' for empty/undefined. */
  readonly normalized: string;
}

/**
 * Normalizes a domain for comparison: trims surrounding whitespace, lowercases,
 * and strips a single leading "www." prefix. Empty or undefined input yields ''.
 * Pure and deterministic.
 */
export const normalizeCandidateDomain = (
  domain: string | undefined,
): string => {
  if (!domain) {
    return "";
  }
  const lower = domain.trim().toLowerCase();
  if (lower.startsWith("www.")) {
    return lower.slice(4);
  }
  return lower;
};

/**
 * Detects whether a domain is being seen for the first time. Both the candidate
 * and every entry in seenDomains are normalized (lowercase, leading "www."
 * stripped) before comparison. An empty or undefined domain is never treated as
 * new and returns an empty normalized value. Use this to apply extra caution to
 * freshly seen domains.
 * Pure and deterministic.
 */
export const detectNewDomain = (
  domain: string | undefined,
  seenDomains: readonly string[],
): NewDomainSignal => {
  const normalized = normalizeCandidateDomain(domain);
  if (normalized === "") {
    return { isNew: false, normalized: "" };
  }
  for (const seen of seenDomains) {
    if (normalizeCandidateDomain(seen) === normalized) {
      return { isNew: false, normalized };
    }
  }
  return { isNew: true, normalized };
};
