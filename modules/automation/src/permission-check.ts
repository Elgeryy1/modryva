/**
 * Result of a daily bot-permission verification: whether every required
 * permission is currently granted, and the list of the ones that are not.
 * Pure and deterministic.
 */
export interface PermissionCheckResult {
  /** True when no required permission is missing. */
  readonly ok: boolean;
  /** Required permissions absent from `current`, in `required` order, deduplicated. */
  readonly missing: readonly string[];
}

/**
 * Verifies that a bot currently holds every permission it needs, for a daily
 * self-audit. `missing` contains the required permissions that are NOT present
 * in `current`, preserving the order of `required` and removing duplicates.
 * `ok` is true exactly when `missing` is empty. Blank/whitespace-only required
 * entries are ignored. Matching is exact and case-sensitive.
 * Pure and deterministic.
 */
export const checkBotPermissions = (
  current: readonly string[],
  required: readonly string[],
): PermissionCheckResult => {
  const held = new Set<string>(current);
  const missing: string[] = [];
  for (const permission of required) {
    if (permission.trim().length === 0) {
      continue;
    }
    if (!held.has(permission) && !missing.includes(permission)) {
      missing.push(permission);
    }
  }
  return { ok: missing.length === 0, missing };
};

/**
 * Formats the check result as a short Spanish admin notice for the daily
 * permission audit. Emits a success line when nothing is missing, otherwise a
 * warning listing the missing permissions.
 * Pure and deterministic.
 */
export const formatPermissionNotice = (
  result: PermissionCheckResult,
): string => {
  if (result.ok) {
    return "✅ Verificacion diaria: el bot tiene todos los permisos necesarios.";
  }
  return `⚠️ Verificacion diaria: faltan ${result.missing.length} permiso(s): ${result.missing.join(", ")}.`;
};
