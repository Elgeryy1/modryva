/**
 * A single recorded rule violation. `ruleId` is the stable key used for
 * tallying, while `ruleName` is the human readable label shown to admins.
 */
export interface RuleViolation {
  readonly ruleId: string;
  readonly ruleName: string;
}

/**
 * One entry in the broken-rules ranking: a rule plus how many times it was
 * broken across the supplied violations.
 */
export interface RuleRanking {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly count: number;
}

/**
 * Builds a ranking of the most broken rules. Violations are tallied by
 * `ruleId`, and the `ruleName` of the first occurrence of each id is kept as
 * the label. The result is sorted by `count` descending, breaking ties by
 * `ruleName` ascending and then by `ruleId` ascending, both using a plain
 * `<` comparison so the ordering is locale-agnostic. Returns an empty array
 * for an empty input and never mutates the input. Pure and deterministic.
 */
export const rankBrokenRules = (
  violations: readonly RuleViolation[],
): readonly RuleRanking[] => {
  const order: string[] = [];
  const names = new Map<string, string>();
  const counts = new Map<string, number>();
  for (const violation of violations) {
    const ruleId = violation.ruleId;
    const previous = counts.get(ruleId);
    if (previous === undefined) {
      order.push(ruleId);
      names.set(ruleId, violation.ruleName);
      counts.set(ruleId, 1);
    } else {
      counts.set(ruleId, previous + 1);
    }
  }
  const ranking: RuleRanking[] = order.map((ruleId) => ({
    ruleId,
    ruleName: names.get(ruleId) ?? "",
    count: counts.get(ruleId) ?? 0,
  }));
  ranking.sort((a, b) => {
    if (a.count !== b.count) {
      return b.count - a.count;
    }
    if (a.ruleName !== b.ruleName) {
      return a.ruleName < b.ruleName ? -1 : 1;
    }
    if (a.ruleId !== b.ruleId) {
      return a.ruleId < b.ruleId ? -1 : 1;
    }
    return 0;
  });
  return ranking;
};
