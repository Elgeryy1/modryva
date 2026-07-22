/**
 * Result of comparing a previous rules list against the current one.
 * Values in added/removed are trimmed and deduplicated, preserving the
 * order in which they first appear in their source list.
 * Pure and deterministic.
 */
export interface RulesDiff {
  /** Rules present now that were not present before (current order). */
  readonly added: readonly string[];
  /** Rules present before that are gone now (previous order). */
  readonly removed: readonly string[];
  /** Count of distinct rules present in both lists. */
  readonly unchangedCount: number;
  /** User-facing Spanish summary of the changes. */
  readonly summary: string;
}

/**
 * Trims each rule, drops entries that become empty, and deduplicates while
 * preserving first-seen order. Comparison is by exact trimmed string.
 * Pure and deterministic.
 */
const normalizeRules = (rules: readonly string[]): readonly string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const rule of rules) {
    const trimmed = rule.trim();
    if (trimmed.length === 0) {
      continue;
    }
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
};

/**
 * Formats a count with its singular or plural noun, e.g. "1 anadida" or
 * "3 anadidas". The noun forms are provided already accented by the caller.
 * Pure and deterministic.
 */
const describeCount = (
  count: number,
  singular: string,
  plural: string,
): string => `${count} ${count === 1 ? singular : plural}`;

/**
 * Builds the Spanish summary string from the added and removed counts.
 * Only non-empty groups appear; a zero total reports that nothing changed.
 * Pure and deterministic.
 */
const buildSummary = (addedCount: number, removedCount: number): string => {
  const total = addedCount + removedCount;
  if (total === 0) {
    return "No hubo cambios en las normas.";
  }
  const parts: string[] = [];
  if (addedCount > 0) {
    parts.push(describeCount(addedCount, "añadida", "añadidas"));
  }
  if (removedCount > 0) {
    parts.push(describeCount(removedCount, "eliminada", "eliminadas"));
  }
  const header = total === 1 ? "Cambió 1 cosa" : `Cambiaron ${total} cosas`;
  return `${header}: ${parts.join(", ")}. 📝`;
};

/**
 * Compares a previous and a current list of rules, reporting which rules
 * were added, which were removed, how many stayed, and a Spanish summary.
 * Rules are compared by trimmed string equality; empty and duplicate
 * entries are ignored. Order of added/removed follows the source lists.
 * Pure and deterministic.
 */
export const diffRules = (
  previous: readonly string[],
  current: readonly string[],
): RulesDiff => {
  const prev = normalizeRules(previous);
  const curr = normalizeRules(current);
  const prevSet = new Set(prev);
  const currSet = new Set(curr);
  const added = curr.filter((rule) => !prevSet.has(rule));
  const removed = prev.filter((rule) => !currSet.has(rule));
  let unchangedCount = 0;
  for (const rule of prev) {
    if (currSet.has(rule)) {
      unchangedCount += 1;
    }
  }
  return {
    added,
    removed,
    unchangedCount,
    summary: buildSummary(added.length, removed.length),
  };
};
