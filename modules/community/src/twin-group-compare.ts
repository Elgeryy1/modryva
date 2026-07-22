/**
 * One metric compared across two twin groups, naming which side leads.
 * Pure and deterministic.
 */
export interface TwinGroupComparison {
  readonly metric: string;
  readonly aValue: number;
  readonly bValue: number;
  readonly leader: "a" | "b" | "igual";
}

/**
 * Compares two similar ("twin") groups metric by metric. The union of both
 * metric keys is compared in sorted order; a missing metric counts as 0. Each
 * row names the leading side ("a", "b" or "igual"). Pure and deterministic.
 */
export const compareTwinGroups = (
  a: Readonly<Record<string, number>>,
  b: Readonly<Record<string, number>>,
): readonly TwinGroupComparison[] => {
  const metrics = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  return metrics.map((metric) => {
    const aValue = a[metric] ?? 0;
    const bValue = b[metric] ?? 0;
    const leader = aValue > bValue ? "a" : aValue < bValue ? "b" : "igual";
    return { metric, aValue, bValue, leader };
  });
};
