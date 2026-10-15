/**
 * Direction of a metric change between two months.
 * "sube" means the value grew, "baja" means it shrank, "igual" means no change.
 */
export type MonthMetricTrend = "sube" | "baja" | "igual";

/**
 * A single metric compared against the previous month.
 */
export interface MonthMetricChange {
  /** Metric key, e.g. "spam" or "retencion". */
  readonly metric: string;
  /** Signed difference current minus previous. */
  readonly delta: number;
  /** Trend derived from the sign of delta. */
  readonly direction: MonthMetricTrend;
}

/**
 * Resolves the trend label from a signed delta.
 * Pure and deterministic.
 */
const trendFromDelta = (delta: number): MonthMetricTrend => {
  if (delta > 0) {
    return "sube";
  }
  if (delta < 0) {
    return "baja";
  }
  return "igual";
};

/**
 * Compares the current month metrics against the previous month.
 * For every key present in current, delta = current - previous, treating a
 * missing previous value as 0. The direction is derived from the sign of the
 * delta. Results are sorted by metric name ascending for a stable order.
 * Pure and deterministic.
 */
export const compareMonths = (
  current: Readonly<Record<string, number>>,
  previous: Readonly<Record<string, number>>,
): readonly MonthMetricChange[] => {
  const metrics = Object.keys(current).sort();
  const changes: MonthMetricChange[] = [];
  for (const metric of metrics) {
    const currentValue = current[metric] ?? 0;
    const previousValue = previous[metric] ?? 0;
    const delta = currentValue - previousValue;
    changes.push({ metric, delta, direction: trendFromDelta(delta) });
  }
  return changes;
};
