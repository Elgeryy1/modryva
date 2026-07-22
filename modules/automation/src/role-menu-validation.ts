/**
 * A menu command and the roles allowed to see it. An empty allowedRoles means
 * the command is visible to everyone. Pure and deterministic.
 */
export interface RoleMenuItem {
  readonly command: string;
  readonly allowedRoles: readonly string[];
}

/**
 * The commands a role should see and the ones it should not, preserving input
 * order within each list. Pure and deterministic.
 */
export interface RoleMenuValidation {
  readonly visible: readonly string[];
  readonly hidden: readonly string[];
}

/**
 * Validates a per-role menu: a command is visible when its allowedRoles is
 * empty (applies to all) or includes the role; otherwise it is hidden. Input
 * order is preserved. Pure and deterministic.
 */
export const validateRoleMenu = (
  items: readonly RoleMenuItem[],
  role: string,
): RoleMenuValidation => {
  const visible: string[] = [];
  const hidden: string[] = [];
  for (const item of items) {
    if (item.allowedRoles.length === 0 || item.allowedRoles.includes(role)) {
      visible.push(item.command);
    } else {
      hidden.push(item.command);
    }
  }
  return { visible, hidden };
};
