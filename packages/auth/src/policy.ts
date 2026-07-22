import type { AccessContext, PermissionKey } from "@superbot/domain";
import { hasPermission } from "./rbac.js";

export interface PolicyDecision {
  readonly allowed: boolean;
  readonly reason?: string;
}

export const evaluatePolicy = (
  context: AccessContext,
  permission: PermissionKey,
  options: { moduleName: string; critical?: boolean },
): PolicyDecision => {
  if (!context.moduleEnabled) {
    return { allowed: false, reason: `module:${options.moduleName}:disabled` };
  }

  if (!context.isTelegramAdmin && permission.startsWith("moderation")) {
    return { allowed: false, reason: "telegram-admin-required" };
  }

  if (
    options.critical &&
    context.role !== "owner" &&
    context.role !== "system"
  ) {
    return { allowed: false, reason: "critical-action-owner-only" };
  }

  if (
    !hasPermission(context.role, permission) &&
    !context.permissions.includes(permission)
  ) {
    return { allowed: false, reason: `permission:${permission}:missing` };
  }

  return { allowed: true };
};
