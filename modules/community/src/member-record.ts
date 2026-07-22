/**
 * A single warning applied to a member, with an absolute expiry timestamp
 * expressed in epoch milliseconds.
 */
export interface MemberWarn {
  /** Human-readable reason for the warning (may be shown to admins). */
  readonly reason: string;
  /** Absolute expiry instant in epoch milliseconds. */
  readonly expiresMs: number;
}

/**
 * An active warning together with the time left before it expires.
 */
export interface ActiveWarn {
  /** Human-readable reason for the warning. */
  readonly reason: string;
  /** Milliseconds remaining until expiry (always strictly positive). */
  readonly remainingMs: number;
}

/**
 * Compact summary of a member disciplinary record at a given instant.
 */
export interface MemberRecordSummary {
  /** Count of warnings that are still active at nowMs. */
  readonly activeCount: number;
  /** Count of warnings that have already expired at nowMs. */
  readonly expiredCount: number;
  /** Active warnings sorted by remainingMs ascending (soonest to expire first). */
  readonly active: readonly ActiveWarn[];
}

/**
 * Summarizes a member's clean-record status at instant nowMs. A warning is
 * active when its expiresMs is strictly greater than nowMs; otherwise it is
 * counted as expired. Active warnings are returned with their remainingMs
 * (expiresMs - nowMs) and sorted by remainingMs ascending; ties keep their
 * original input order (stable). An empty input yields zero counts and no
 * active warnings. Pure and deterministic.
 */
export const summarizeMemberRecord = (
  warns: readonly MemberWarn[],
  nowMs: number,
): MemberRecordSummary => {
  const active: ActiveWarn[] = [];
  let expiredCount = 0;
  for (const warn of warns) {
    if (warn.expiresMs > nowMs) {
      active.push({ reason: warn.reason, remainingMs: warn.expiresMs - nowMs });
    } else {
      expiredCount += 1;
    }
  }
  const sorted = active
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const byRemaining = a.entry.remainingMs - b.entry.remainingMs;
      return byRemaining !== 0 ? byRemaining : a.index - b.index;
    })
    .map((wrapped) => wrapped.entry);
  return { activeCount: sorted.length, expiredCount, active: sorted };
};
