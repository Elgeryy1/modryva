/**
 * A single appeal record: whether the appeal was accepted and which moderation
 * rule it targeted.
 * Pure data shape with no behavior.
 */
export interface AppealRecord {
  readonly accepted: boolean;
  readonly rule: string;
}

/**
 * Number of accepted appeals attributed to one rule.
 * Pure data shape with no behavior.
 */
export interface RuleCount {
  readonly rule: string;
  readonly count: number;
}

/**
 * Aggregated report of accepted appeals. Useful to spot which rules get
 * reversed the most and therefore deserve review or refinement.
 * `acceptedTotal` always equals the sum of every `count` in `byRule`.
 * Pure data shape with no behavior.
 */
export interface AcceptedAppealsReport {
  readonly acceptedTotal: number;
  readonly byRule: readonly RuleCount[];
}

/**
 * Summarizes accepted appeals grouped by rule. Rejected appeals are ignored.
 * Rules are compared as exact strings (no case folding or trimming), so callers
 * are responsible for normalizing rule names beforehand if needed. The `byRule`
 * list is sorted by `count` descending, breaking ties by `rule` ascending in
 * codepoint order. Empty input yields an empty report.
 * Pure and deterministic.
 */
export const summarizeAcceptedAppeals = (
  appeals: readonly AppealRecord[],
): AcceptedAppealsReport => {
  const counts = new Map<string, number>();
  for (const appeal of appeals) {
    if (!appeal.accepted) {
      continue;
    }
    const current = counts.get(appeal.rule) ?? 0;
    counts.set(appeal.rule, current + 1);
  }

  let acceptedTotal = 0;
  const byRule: RuleCount[] = [];
  for (const [rule, count] of counts) {
    acceptedTotal += count;
    byRule.push({ rule, count });
  }

  byRule.sort((a, b) => {
    if (a.count !== b.count) {
      return b.count - a.count;
    }
    if (a.rule < b.rule) {
      return -1;
    }
    if (a.rule > b.rule) {
      return 1;
    }
    return 0;
  });

  return { acceptedTotal, byRule };
};
