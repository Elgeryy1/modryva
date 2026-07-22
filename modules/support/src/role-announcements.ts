/**
 * One announcement variant for a single audience role: the resolved role label
 * plus the role-tuned text (greeting followed by the shared base message).
 * Pure and deterministic.
 */
export interface RoleAnnouncementVariant {
  readonly role: string;
  readonly text: string;
}

/**
 * Resolves the role-specific Spanish greeting for a normalized role key.
 * Unknown roles fall back to a neutral greeting. Internal helper.
 * Pure and deterministic.
 */
const greetingForRole = (normalized: string): string => {
  switch (normalized) {
    case "owner":
    case "dueno":
      return "👑 Hola, dueño del grupo.";
    case "staff":
    case "mods":
    case "moderadores":
      return "🛡️ Hola, equipo de moderación.";
    case "nuevos":
    case "nuevo":
    case "new":
      return "👋 ¡Bienvenido al grupo!";
    case "vip":
    case "vips":
      return "⭐ Hola, miembro VIP.";
    default:
      return "📣 Atención.";
  }
};

/**
 * Builds one announcement variant per role, prepending a role-tuned Spanish
 * greeting to the shared base message. Role matching is case-insensitive and
 * whitespace-tolerant; unknown roles get a neutral greeting. The input roles
 * order is preserved and duplicates are kept. When the base is blank, only the
 * greeting is emitted (no trailing separator).
 * Pure and deterministic.
 */
export const buildRoleAnnouncements = (
  base: string,
  roles: readonly string[],
): readonly RoleAnnouncementVariant[] => {
  const trimmedBase = base.trim();
  const variants: RoleAnnouncementVariant[] = [];
  for (const role of roles) {
    const normalized = role.trim().toLowerCase();
    const greeting = greetingForRole(normalized);
    const text =
      trimmedBase.length > 0 ? `${greeting} ${trimmedBase}` : greeting;
    variants.push({ role, text });
  }
  return variants;
};
