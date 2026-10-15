/**
 * Usage record for a single moderation/automation rule: its name and how many
 * times it has fired so far. Pure data, no behavior.
 */
export interface RuleUsage {
  readonly name: string;
  readonly triggerCount: number;
}

/**
 * Detects "dead" rules: rules that have never fired (triggerCount <= 0) and
 * therefore only add noise. Returns their names preserving input order,
 * including duplicates if the same name appears more than once.
 * A negative triggerCount is treated as dead (defensive: counters never go
 * below zero in practice, but bad data should not hide a dead rule).
 * Empty input yields an empty list.
 * Pure and deterministic.
 */
export const detectDeadRules = (
  rules: readonly RuleUsage[],
): readonly string[] => {
  const dead: string[] = [];
  for (const rule of rules) {
    if (rule.triggerCount <= 0) {
      dead.push(rule.name);
    }
  }
  return dead;
};

/**
 * Builds a short Spanish admin notice listing the dead rules, or a reassuring
 * message when there are none. Uses accented, punctuated user-facing copy.
 * Pure and deterministic.
 */
export const formatDeadRulesNotice = (deadNames: readonly string[]): string => {
  if (deadNames.length === 0) {
    return "✅ Todas las reglas se han activado al menos una vez.";
  }
  const list = deadNames.join(", ");
  const noun = deadNames.length === 1 ? "regla muerta" : "reglas muertas";
  return `⚠️ Aviso: ${deadNames.length} ${noun} que solo hacen ruido: ${list}.`;
};
