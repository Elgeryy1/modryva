/**
 * Interest profile for a single community member used when suggesting
 * connections between people with overlapping interests.
 */
export interface MemberInterests {
  /** Stable numeric identifier of the member. */
  readonly userId: number;
  /** Free-form interest tags declared by the member. */
  readonly interests: readonly string[];
}

/**
 * A suggested connection between two members and how many interests they share.
 */
export interface MemberCompatMatch {
  /** The two member ids, always normalized as [min, max]. */
  readonly pair: readonly [number, number];
  /** Count of distinct interests both members have in common. */
  readonly shared: number;
}

/**
 * Tuning options for suggestConnections.
 */
export interface SuggestConnectionsOptions {
  /** Minimum shared interests required to suggest a pair. Defaults to 2. */
  readonly minShared?: number;
}

/**
 * Normalizes a member's interests into a lowercase, trimmed, deduplicated set.
 * Blank entries are dropped. Pure and deterministic.
 */
const normalizeInterests = (
  interests: readonly string[],
): ReadonlySet<string> => {
  const set = new Set<string>();
  for (const raw of interests) {
    const key = raw.trim().toLowerCase();
    if (key.length > 0) {
      set.add(key);
    }
  }
  return set;
};

/**
 * Counts how many entries of set a are also present in set b.
 * Pure and deterministic.
 */
const countShared = (
  a: ReadonlySet<string>,
  b: ReadonlySet<string>,
): number => {
  let shared = 0;
  for (const value of a) {
    if (b.has(value)) {
      shared += 1;
    }
  }
  return shared;
};

/**
 * Suggests connections between community members with similar interests.
 * For every unordered pair it counts the distinct shared interests
 * (case-insensitive, whitespace-trimmed, deduplicated) and keeps only pairs
 * meeting options.minShared (default 2). Results are sorted by shared count
 * descending, then by pair ascending. Each pair id tuple is normalized to
 * [min, max]. Pure and deterministic.
 */
export const suggestConnections = (
  members: readonly MemberInterests[],
  options?: SuggestConnectionsOptions,
): readonly MemberCompatMatch[] => {
  const minShared = options?.minShared ?? 2;
  const normalized = members.map((member) =>
    normalizeInterests(member.interests),
  );
  const matches: MemberCompatMatch[] = [];
  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      const first = members[i];
      const second = members[j];
      const setA = normalized[i];
      const setB = normalized[j];
      if (
        first === undefined ||
        second === undefined ||
        setA === undefined ||
        setB === undefined
      ) {
        continue;
      }
      const shared = countShared(setA, setB);
      if (shared < minShared) {
        continue;
      }
      const low = Math.min(first.userId, second.userId);
      const high = Math.max(first.userId, second.userId);
      matches.push({ pair: [low, high], shared });
    }
  }
  matches.sort((a, b) => {
    if (a.shared !== b.shared) {
      return b.shared - a.shared;
    }
    if (a.pair[0] !== b.pair[0]) {
      return a.pair[0] - b.pair[0];
    }
    return a.pair[1] - b.pair[1];
  });
  return matches;
};
