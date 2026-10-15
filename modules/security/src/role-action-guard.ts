/**
 * Moderator role in ascending order of privilege.
 * A higher role inherits every capability of the roles below it.
 * Pure and deterministic.
 */
export type RoleActionGuardRole = "junior" | "mod" | "senior" | "owner";

/**
 * Decision returned when checking whether a role may run an action.
 * `requiredRole` is the minimum role the action demands, or `undefined`
 * when the action is unknown. Pure and deterministic.
 */
export interface RoleActionGuardDecision {
  readonly allowed: boolean;
  readonly reason: string;
  readonly requiredRole: RoleActionGuardRole | undefined;
}

/** Privilege ranking; a role may run an action when its rank is >= the required rank. */
const ROLE_RANK: Record<RoleActionGuardRole, number> = {
  junior: 1,
  mod: 2,
  senior: 3,
  owner: 4,
};

/** Minimum role required per known moderation action (canonical, lowercase keys). */
const ACTION_MIN_ROLE: Record<string, RoleActionGuardRole> = {
  warn: "junior",
  mute: "mod",
  kick: "mod",
  ban: "senior",
  global_ban: "owner",
};

/**
 * Decides whether a moderator role is allowed to perform a dangerous action,
 * enforcing a per-action minimum role (e.g. a junior mod cannot global-ban).
 * The action is trimmed and lowercased before lookup; unknown actions are
 * denied for safety. Reasons are user-facing Spanish. Pure and deterministic.
 */
export const canPerformAction = (
  role: RoleActionGuardRole,
  action: string,
): RoleActionGuardDecision => {
  const normalizedAction = action.trim().toLowerCase();
  const requiredRole = ACTION_MIN_ROLE[normalizedAction];
  if (requiredRole === undefined) {
    return {
      allowed: false,
      reason: `⛔ Acción desconocida «${normalizedAction}»: bloqueada por seguridad.`,
      requiredRole: undefined,
    };
  }
  const actorRank = ROLE_RANK[role];
  const requiredRank = ROLE_RANK[requiredRole];
  if (actorRank >= requiredRank) {
    return {
      allowed: true,
      reason: `✅ El rol «${role}» puede ejecutar «${normalizedAction}».`,
      requiredRole,
    };
  }
  return {
    allowed: false,
    reason: `⛔ El rol «${role}» no puede ejecutar «${normalizedAction}»; se requiere «${requiredRole}» o superior.`,
    requiredRole,
  };
};
