/**
 * A staff role grant to evaluate for expiry. staffId identifies the staff
 * member and grantedMs is the epoch-millisecond timestamp when the role
 * was granted.
 * Pure and deterministic.
 */
export interface StaleStaffGrant {
  readonly staffId: number;
  readonly grantedMs: number;
}

/**
 * A staff role flagged as stale because its age exceeds the allowed maximum.
 * ageMs is nowMs minus grantedMs at the moment of evaluation.
 * Pure and deterministic.
 */
export interface StaleStaffRole {
  readonly staffId: number;
  readonly ageMs: number;
}

/**
 * Options for detectStaleStaffRoles. maxAgeMs is the maximum allowed age of a
 * staff role in milliseconds before it is considered stale; defaults to 180 days.
 * Pure and deterministic.
 */
export interface StaleStaffOptions {
  readonly maxAgeMs?: number;
}

/** Default maximum staff-role age: 180 days in milliseconds. */
const DEFAULT_STALE_STAFF_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

/**
 * Detects staff roles whose age (nowMs - grantedMs) strictly exceeds maxAgeMs,
 * so admins can review and renew or revoke them. Grants granted in the future
 * or exactly at the boundary are not flagged. Results are sorted by ageMs
 * descending, ties broken by staffId ascending. maxAgeMs defaults to 180 days.
 * Pure and deterministic.
 */
export const detectStaleStaffRoles = (
  staff: readonly StaleStaffGrant[],
  nowMs: number,
  options?: StaleStaffOptions,
): readonly StaleStaffRole[] => {
  const maxAgeMs = options?.maxAgeMs ?? DEFAULT_STALE_STAFF_MAX_AGE_MS;
  const stale: StaleStaffRole[] = [];
  for (const grant of staff) {
    const ageMs = nowMs - grant.grantedMs;
    if (ageMs > maxAgeMs) {
      stale.push({ staffId: grant.staffId, ageMs });
    }
  }
  stale.sort((a, b) => {
    if (a.ageMs !== b.ageMs) {
      return b.ageMs - a.ageMs;
    }
    return a.staffId - b.staffId;
  });
  return stale;
};
