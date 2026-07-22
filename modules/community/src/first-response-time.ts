/**
 * A single support case with the moment it was opened and, when present,
 * the moment staff first responded. Both fields are epoch milliseconds.
 * A `firstStaffMs` of undefined means no staff reply has happened yet.
 */
export interface FirstResponseCase {
  readonly openedMs: number;
  readonly firstStaffMs: number | undefined;
}

/**
 * Aggregate view of first-response performance across a batch of cases:
 * how many got a valid staff reply, how many are still pending, and the
 * median time-to-first-response in milliseconds.
 */
export interface FirstResponseTimeSummary {
  readonly respondedCount: number;
  readonly pendingCount: number;
  readonly medianMs: number;
}

/**
 * Median of an already-ascending list of numbers. Returns 0 for an empty
 * list; averages the two central values for an even length.
 * Pure and deterministic.
 */
const medianOfSorted = (sorted: readonly number[]): number => {
  const n = sorted.length;
  if (n === 0) {
    return 0;
  }
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) {
    return sorted[mid] ?? 0;
  }
  const low = sorted[mid - 1] ?? 0;
  const high = sorted[mid] ?? 0;
  return (low + high) / 2;
};

/**
 * Computes first-response-time metrics for a batch of support cases.
 * A case counts as responded when `firstStaffMs` is defined and not earlier
 * than `openedMs`; its duration is `firstStaffMs - openedMs`. A case counts
 * as pending when `firstStaffMs` is undefined. Cases where `firstStaffMs`
 * predates `openedMs` are treated as corrupt data and ignored in every
 * figure. `medianMs` is the median of all valid durations, or 0 when there
 * are none. Input order never affects the result.
 * Pure and deterministic.
 */
export const computeFirstResponseTimes = (
  cases: readonly FirstResponseCase[],
): FirstResponseTimeSummary => {
  const durations: number[] = [];
  let pendingCount = 0;
  for (const item of cases) {
    if (item.firstStaffMs === undefined) {
      pendingCount += 1;
      continue;
    }
    if (item.firstStaffMs >= item.openedMs) {
      durations.push(item.firstStaffMs - item.openedMs);
    }
  }
  const sorted = [...durations].sort((a, b) => a - b);
  return {
    respondedCount: durations.length,
    pendingCount,
    medianMs: medianOfSorted(sorted),
  };
};
