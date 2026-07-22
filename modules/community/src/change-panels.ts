/**
 * A single tracked metric with its value before and after a period, plus the
 * direction that counts as an improvement. Pure and deterministic.
 */
export interface ChangePanelMetric {
  /** Human-readable metric label shown in the panels. */
  readonly name: string;
  /** Metric value at the start of the comparison window. */
  readonly before: number;
  /** Metric value at the end of the comparison window. */
  readonly after: number;
  /** When true a higher value is better; when false a lower value is better. */
  readonly higherIsBetter: boolean;
}

/**
 * Two panels of metric names: those that improved and those that worsened.
 * Metrics with no change are omitted from both panels. Pure and deterministic.
 */
export interface ChangePanels {
  /** Names of metrics that moved in the desired direction, in input order. */
  readonly improved: readonly string[];
  /** Names of metrics that moved against the desired direction, in input order. */
  readonly worsened: readonly string[];
}

/**
 * Splits metrics into "improved" and "worsened" panels based on the sign of
 * (after - before) combined with each metric's higherIsBetter flag. Metrics
 * with a zero delta (ties) are excluded from both panels. Input order is
 * preserved within each panel. Pure and deterministic.
 */
export const computeChangePanels = (
  metrics: readonly ChangePanelMetric[],
): ChangePanels => {
  const improved: string[] = [];
  const worsened: string[] = [];
  for (const metric of metrics) {
    const delta = metric.after - metric.before;
    if (delta === 0) {
      continue;
    }
    const isImprovement = metric.higherIsBetter ? delta > 0 : delta < 0;
    if (isImprovement) {
      improved.push(metric.name);
    } else {
      worsened.push(metric.name);
    }
  }
  return { improved, worsened };
};
