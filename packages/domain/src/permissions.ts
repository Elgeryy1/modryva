export type PermissionKey =
  | "bot.read"
  | "bot.write"
  | "config.read"
  | "config.write"
  | "audit.read"
  | "audit.write"
  | "moderation.write"
  | "moderation.read"
  | "security.write"
  | "security.read"
  | "tenant.admin";

export type ActorRole =
  | "owner"
  | "admin"
  | "moderator"
  | "member"
  | "guest"
  | "system";

export interface AccessContext {
  readonly role: ActorRole;
  readonly permissions: readonly PermissionKey[];
  readonly isTelegramAdmin: boolean;
  readonly moduleEnabled: boolean;
}
