/**
 * Result of auditing granted permissions against the ones actually used,
 * following a least-privilege policy.
 */
export interface PrivilegeReductionSuggestion {
  /**
   * Granted permissions that never appear in the used list, preserving the
   * order in which they were granted and deduplicated.
   */
  readonly unused: readonly string[];
  /** User-facing Spanish advice summarizing the suggestion. */
  readonly advice: string;
}

/**
 * Builds the Spanish advice message for a given list of unused permissions.
 * Internal helper, not exported to avoid barrel symbol clashes.
 * Pure and deterministic.
 */
const buildPrivilegeAdvice = (unused: readonly string[]): string => {
  if (unused.length === 0) {
    return "✅ No hay permisos sin usar; ya se aplica el principio de mínimos privilegios.";
  }
  const noun = unused.length === 1 ? "permiso" : "permisos";
  const list = unused.join(", ");
  return `⚠️ Se recomienda quitar ${unused.length} ${noun} sin usar: ${list}. Aplica el principio de mínimos privilegios para reducir la superficie de ataque.`;
};

/**
 * Suggests which granted permissions can be revoked because they are never
 * used. A permission is considered unused when it is present in `granted` but
 * not in `used` (exact match). The result preserves the granted order and
 * removes duplicates. Missing or empty inputs yield an empty suggestion.
 * Pure and deterministic.
 */
export const suggestPrivilegeReduction = (
  granted: readonly string[] | undefined,
  used: readonly string[] | undefined,
): PrivilegeReductionSuggestion => {
  const grantedList = granted ?? [];
  const usedSet = new Set<string>(used ?? []);
  const unused: string[] = [];
  for (const permission of grantedList) {
    if (!usedSet.has(permission) && !unused.includes(permission)) {
      unused.push(permission);
    }
  }
  return { unused, advice: buildPrivilegeAdvice(unused) };
};
