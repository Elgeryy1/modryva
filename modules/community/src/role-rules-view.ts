/**
 * A single group rule together with the roles it targets.
 * An empty `roles` array marks a universal rule that every member sees.
 */
export interface RoleRule {
  /** The human-readable rule text as shown to the member. */
  readonly text: string;
  /**
   * Role tags this rule applies to (case-insensitive, whitespace-trimmed).
   * An empty array means the rule applies to all roles.
   */
  readonly roles: readonly string[];
}

/**
 * Normalizes a role tag for comparison: trims surrounding whitespace and
 * lowercases it, so "Staff", " staff " and "STAFF" are treated as equal.
 * Pure and deterministic.
 */
const normalizeRole = (role: string): string => role.trim().toLowerCase();

/**
 * Returns the texts of every rule that applies to `role`, preserving the
 * original order of `rules`. A rule applies when its `roles` array is empty
 * (universal) or when it contains `role` under case-insensitive, trimmed
 * matching. Duplicate texts are kept as-is; a fresh array is always returned.
 * Pure and deterministic.
 */
export const filterRulesByRole = (
  rules: readonly RoleRule[],
  role: string,
): readonly string[] => {
  const target = normalizeRole(role);
  const result: string[] = [];
  for (const rule of rules) {
    if (rule.roles.length === 0) {
      result.push(rule.text);
      continue;
    }
    let applies = false;
    for (const candidate of rule.roles) {
      if (normalizeRole(candidate) === target) {
        applies = true;
        break;
      }
    }
    if (applies) {
      result.push(rule.text);
    }
  }
  return result;
};

/**
 * Lists the distinct, normalized role tags referenced across `rules`, in
 * first-seen order. Universal rules (empty `roles`) contribute nothing, and
 * blank or whitespace-only tags are ignored. Useful to render the set of roles
 * that have tailored rules. A fresh array is always returned.
 * Pure and deterministic.
 */
export const distinctRoles = (
  rules: readonly RoleRule[],
): readonly string[] => {
  const seen: string[] = [];
  for (const rule of rules) {
    for (const candidate of rule.roles) {
      const normalized = normalizeRole(candidate);
      if (normalized.length > 0 && !seen.includes(normalized)) {
        seen.push(normalized);
      }
    }
  }
  return seen;
};
