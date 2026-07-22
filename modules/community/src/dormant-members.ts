/**
 * A member candidate to evaluate for dormancy. lastActiveMs is the epoch
 * timestamp in milliseconds of the member's last observed activity.
 */
export interface DormantMemberInput {
  readonly userId: number;
  readonly lastActiveMs: number;
}

/**
 * A member detected as dormant, together with how long it has been idle
 * in milliseconds relative to the provided nowMs.
 */
export interface DormantMember {
  readonly userId: number;
  readonly idleMs: number;
}

/**
 * Default dormancy window: a member idle for at least 14 days is considered
 * dormant. Expressed in milliseconds. Pure and deterministic.
 */
export const DORMANT_DEFAULT_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Detects dormant members eligible for a soft reactivation nudge. A member is
 * dormant when its idle time (nowMs minus lastActiveMs) is at least
 * dormantAfterMs (default DORMANT_DEFAULT_AFTER_MS). Members active in the
 * future (negative idle) are never dormant. Results are sorted by idleMs
 * descending, breaking ties by userId ascending, so the output order is
 * stable regardless of input order. The input array is never mutated.
 * Pure and deterministic.
 */
export const detectDormantMembers = (
  members: readonly DormantMemberInput[],
  nowMs: number,
  options?: { readonly dormantAfterMs?: number },
): readonly DormantMember[] => {
  const threshold = options?.dormantAfterMs ?? DORMANT_DEFAULT_AFTER_MS;
  const dormant: DormantMember[] = [];
  for (const member of members) {
    const idleMs = nowMs - member.lastActiveMs;
    if (idleMs >= threshold) {
      dormant.push({ userId: member.userId, idleMs });
    }
  }
  dormant.sort((a, b) => {
    if (b.idleMs !== a.idleMs) {
      return b.idleMs - a.idleMs;
    }
    return a.userId - b.userId;
  });
  return dormant;
};
