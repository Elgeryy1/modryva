/**
 * Human-readable explanation for a single Telegram admin permission.
 * Pure and deterministic.
 */
export interface PermissionExplanation {
  /** True when the permission key is recognized. Pure and deterministic. */
  readonly known: boolean;
  /** Short user-facing Spanish title for the permission. Pure and deterministic. */
  readonly title: string;
  /** User-facing Spanish explanation with a real-world example. Pure and deterministic. */
  readonly explanation: string;
}

interface PermissionEntry {
  readonly title: string;
  readonly explanation: string;
}

/**
 * Catalog of supported Telegram admin permissions mapped to their
 * user-facing Spanish title and explanation. Keys are the canonical
 * Telegram permission identifiers in plain ASCII.
 * Pure and deterministic.
 */
const PERMISSIONS: Readonly<Record<string, PermissionEntry>> = {
  can_delete_messages: {
    title: "🗑️ Eliminar mensajes",
    explanation:
      "Permite borrar cualquier mensaje del grupo, no solo los propios. Ejemplo: un usuario publica spam y el administrador lo elimina al instante.",
  },
  can_restrict_members: {
    title: "🔇 Restringir miembros",
    explanation:
      "Permite silenciar, limitar o expulsar a miembros del grupo. Ejemplo: alguien insulta a los demas y el administrador lo silencia durante una hora.",
  },
  can_pin_messages: {
    title: "📌 Fijar mensajes",
    explanation:
      "Permite anclar un mensaje en la parte superior del chat para que todos lo vean. Ejemplo: se fijan las reglas del grupo para que nadie las pase por alto.",
  },
  can_invite_users: {
    title: "➕ Invitar usuarios",
    explanation:
      "Permite anadir miembros y generar enlaces de invitacion al grupo. Ejemplo: el administrador crea un enlace temporal para un evento y lo comparte.",
  },
  can_change_info: {
    title: "✏️ Cambiar informacion",
    explanation:
      "Permite editar el nombre, la foto y la descripcion del grupo. Ejemplo: se actualiza el titulo del grupo al empezar una nueva temporada.",
  },
};

/**
 * Fallback explanation returned when the permission key is not recognized.
 * Pure and deterministic.
 */
const UNKNOWN: PermissionExplanation = {
  known: false,
  title: "❓ Permiso desconocido",
  explanation:
    "No reconozco este permiso. Revisa el nombre e intentalo de nuevo con un permiso valido de Telegram.",
};

/**
 * Explains a single Telegram admin permission with a real-world Spanish
 * example. The lookup is case-insensitive and tolerant of surrounding
 * whitespace and a leading "can_" is optional. Unknown or empty keys yield
 * a generic result with known = false.
 * Pure and deterministic.
 */
export const explainPermission = (
  permission: string | undefined,
): PermissionExplanation => {
  if (!permission) {
    return UNKNOWN;
  }
  const normalized = permission.trim().toLowerCase();
  if (normalized.length === 0) {
    return UNKNOWN;
  }
  const key = normalized.startsWith("can_") ? normalized : `can_${normalized}`;
  const entry = PERMISSIONS[key];
  if (entry === undefined) {
    return UNKNOWN;
  }
  return { known: true, title: entry.title, explanation: entry.explanation };
};

/**
 * Returns the sorted list of supported permission keys (canonical Telegram
 * identifiers). Order is stable and alphabetical.
 * Pure and deterministic.
 */
export const listKnownPermissions = (): readonly string[] =>
  Object.keys(PERMISSIONS).sort((a, b) => a.localeCompare(b));
