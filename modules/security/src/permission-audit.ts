/**
 * Least-privilege audit for group administrators. Given a snapshot of each
 * admin's granted permissions and their last moderation action, this module
 * flags excess privileges: dangerous powers (ban/delete/promote) that have not
 * been used recently, and the ability to promote other admins granted to
 * someone who does not actually moderate. Pure and deterministic: callers pass
 * `nowMs` and the staleness window, so there is no clock or I/O here.
 */

/**
 * Snapshot of one administrator's granted powers. `lastActionMs` is the epoch
 * timestamp (ms) of their most recent moderation action; omit it entirely when
 * the admin has never acted (never assign undefined).
 */
export interface AdminPerms {
  readonly userId: string;
  readonly canBan: boolean;
  readonly canDelete: boolean;
  readonly canPin: boolean;
  readonly canPromote: boolean;
  readonly lastActionMs?: number;
}

/** A single excess-privilege finding tied to one administrator. */
export interface ExcessPermissionFinding {
  readonly userId: string;
  readonly reason: string;
}

/**
 * Stable, user-facing reasons for each excess-privilege category. Accented on
 * purpose: these strings surface in the audit report an admin reads.
 */
export const PERM_AUDIT_REASONS = {
  promoteWithoutModeration: "Puede promover administradores pero no modera",
  staleDangerous: "Permisos peligrosos sin actividad reciente",
} as const;

/** True when the admin holds a moderation power (ban or delete). */
export const adminModerates = (admin: AdminPerms): boolean =>
  admin.canBan || admin.canDelete;

/**
 * True when the admin holds any dangerous power: banning, deleting or
 * promoting other admins. Pinning is not dangerous.
 */
export const adminHasDangerousPermission = (admin: AdminPerms): boolean =>
  admin.canBan || admin.canDelete || admin.canPromote;

/**
 * True when the admin acted within the staleness window, i.e. `lastActionMs`
 * is known and `nowMs - lastActionMs <= staleMs`. An admin who never acted
 * (no `lastActionMs`) is never considered recent. Deterministic.
 */
export const adminActedRecently = (
  admin: AdminPerms,
  nowMs: number,
  staleMs: number,
): boolean => {
  if (admin.lastActionMs === undefined) {
    return false;
  }
  return nowMs - admin.lastActionMs <= staleMs;
};

/**
 * Returns at most one finding per admin, preserving input order. An admin is
 * flagged when they can promote other admins but do not moderate (structural
 * over-grant, checked first), or when they hold dangerous powers they have not
 * exercised within `staleMs`. Admins with only harmless powers (e.g. pin) or
 * with recently-used dangerous powers produce no finding. Pure and
 * deterministic: identical inputs yield an identical array.
 */
export const findExcessPermissions = (
  admins: readonly AdminPerms[],
  nowMs: number,
  staleMs: number,
): readonly ExcessPermissionFinding[] => {
  const findings: ExcessPermissionFinding[] = [];

  for (const admin of admins) {
    if (admin.canPromote && !adminModerates(admin)) {
      findings.push({
        userId: admin.userId,
        reason: PERM_AUDIT_REASONS.promoteWithoutModeration,
      });
      continue;
    }

    if (
      adminHasDangerousPermission(admin) &&
      !adminActedRecently(admin, nowMs, staleMs)
    ) {
      findings.push({
        userId: admin.userId,
        reason: PERM_AUDIT_REASONS.staleDangerous,
      });
    }
  }

  return findings;
};
