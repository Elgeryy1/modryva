import type { ActorRole, PermissionKey } from "@superbot/domain";

export const rolePermissions: Record<ActorRole, readonly PermissionKey[]> = {
  owner: [
    "bot.read",
    "bot.write",
    "config.read",
    "config.write",
    "audit.read",
    "audit.write",
    "moderation.read",
    "moderation.write",
    "security.read",
    "security.write",
    "tenant.admin",
  ],
  admin: [
    "bot.read",
    "bot.write",
    "config.read",
    "config.write",
    "audit.read",
    "moderation.read",
    "moderation.write",
    "security.read",
    "security.write",
  ],
  moderator: ["bot.read", "moderation.read", "moderation.write", "audit.read"],
  member: ["bot.read"],
  guest: ["bot.read"],
  system: ["bot.read", "bot.write", "audit.read", "audit.write"],
};

export const resolvePermissions = (role: ActorRole): readonly PermissionKey[] =>
  rolePermissions[role];

export const hasPermission = (
  role: ActorRole,
  permission: PermissionKey,
): boolean => resolvePermissions(role).includes(permission);
