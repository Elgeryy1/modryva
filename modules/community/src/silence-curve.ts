/**
 * A single observed member for the silence-curve analysis: the moment they
 * joined the group and, when known, the moment they first participated.
 * firstMessageMs is undefined when the member has never sent a message.
 * Pure and deterministic.
 */
export interface SilenceMember {
  readonly joinMs: number;
  readonly firstMessageMs: number | undefined;
}

/**
 * Aggregated "silence curve" metrics for a set of members, describing how long
 * newcomers take to participate for the first time. participatedCount plus
 * neverSpokeCount always equals the number of members supplied.
 * Pure and deterministic.
 */
export interface SilenceCurve {
  readonly participatedCount: number;
  readonly neverSpokeCount: number;
  readonly medianDelayMs: number;
  readonly participationRatio: number;
}

/**
 * Returns the median of a numeric list sorted in ascending order. For an even
 * length it averages the two central values; for an empty list it returns 0.
 * Pure and deterministic.
 */
const medianOfSorted = (sortedAsc: readonly number[]): number => {
  const n = sortedAsc.length;
  if (n === 0) {
    return 0;
  }
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) {
    return sortedAsc[mid] ?? 0;
  }
  const lo = sortedAsc[mid - 1] ?? 0;
  const hi = sortedAsc[mid] ?? 0;
  return (lo + hi) / 2;
};

/**
 * Computes the silence curve of a community: how long members take to speak for
 * the first time. A member counts as participated when firstMessageMs is defined
 * and at or after joinMs, contributing a delay of firstMessageMs - joinMs.
 * Members with no first message, or whose first message predates joining (treated
 * as invalid data), count toward neverSpokeCount. medianDelayMs is 0 when nobody
 * participated, and participationRatio is participatedCount over the total number
 * of members in the range 0..1 rounded to 2 decimals (0 for an empty list). The
 * result does not depend on the input order.
 * Pure and deterministic.
 */
export const computeSilenceCurve = (
  members: readonly SilenceMember[],
): SilenceCurve => {
  const delays: number[] = [];
  let neverSpokeCount = 0;
  for (const member of members) {
    const firstMessageMs = member.firstMessageMs;
    if (firstMessageMs !== undefined && firstMessageMs >= member.joinMs) {
      delays.push(firstMessageMs - member.joinMs);
    } else {
      neverSpokeCount += 1;
    }
  }
  const participatedCount = delays.length;
  const total = members.length;
  const sortedAsc = [...delays].sort((a, b) => a - b);
  const participationRatio =
    total === 0 ? 0 : Math.round((participatedCount / total) * 100) / 100;
  return {
    participatedCount,
    neverSpokeCount,
    medianDelayMs: medianOfSorted(sortedAsc),
    participationRatio,
  };
};
