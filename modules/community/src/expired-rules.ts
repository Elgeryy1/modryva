/**
 * A single group rule that carries an absolute expiration instant.
 * Useful for temporary rules tied to events (giveaways, seasonal campaigns).
 * Pure and deterministic.
 */
export interface ExpiringRule {
  /** The human-readable rule text shown to members. */
  readonly text: string;
  /** Absolute expiration instant in epoch milliseconds. */
  readonly expiresMs: number;
}

/**
 * Partition of rule texts into expired and still-active groups.
 * Both lists preserve the original input order.
 * Pure and deterministic.
 */
export interface ExpiredRulesReport {
  /** Texts of rules whose expiration instant is at or before nowMs. */
  readonly expired: readonly string[];
  /** Texts of rules whose expiration instant is strictly after nowMs. */
  readonly active: readonly string[];
}

/**
 * Splits rules into expired and active groups relative to nowMs. A rule is
 * considered expired when its expiresMs is less than or equal to nowMs
 * (the boundary instant counts as expired). Input order is preserved in both
 * output lists. Rules with a non-finite expiresMs are treated as active
 * (never expiring) so a malformed timestamp does not silently drop a rule.
 * Pure and deterministic.
 */
export const detectExpiredRules = (
  rules: readonly ExpiringRule[],
  nowMs: number,
): ExpiredRulesReport => {
  const expired: string[] = [];
  const active: string[] = [];
  for (const rule of rules) {
    if (Number.isFinite(rule.expiresMs) && rule.expiresMs <= nowMs) {
      expired.push(rule.text);
    } else {
      active.push(rule.text);
    }
  }
  return { expired, active };
};
