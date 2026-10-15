/**
 * A single moderation/support case carrying a numeric severity score.
 * Higher numbers mean a more severe case. Pure and deterministic.
 */
export interface SeverityTrendCase {
  readonly severity: number;
}

/**
 * Options for computeSeverityTrend. `window` is how many trailing cases form
 * the "recent" bucket (and, equally sized, the "earlier" bucket before it).
 * Defaults to 5, clamped to a minimum of 1. Pure and deterministic.
 */
export interface SeverityTrendOptions {
  readonly window?: number;
}

/**
 * Result of comparing the recent severity average against the earlier one.
 * `direction` is a user-facing Spanish label: "sube", "baja" or "estable".
 * Averages are rounded to 2 decimals. Pure and deterministic.
 */
export interface SeverityTrendReport {
  readonly recentAvg: number;
  readonly earlierAvg: number;
  readonly direction: "sube" | "baja" | "estable";
}

const DEFAULT_SEVERITY_WINDOW = 5;

/** Rounds a number to 2 decimals. Pure and deterministic. */
const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Averages the severity of a bucket, rounded to 2 decimals. Empty bucket
 * yields 0. Pure and deterministic.
 */
const averageSeverity = (bucket: readonly SeverityTrendCase[]): number => {
  if (bucket.length === 0) {
    return 0;
  }
  let total = 0;
  for (const item of bucket) {
    total += item.severity;
  }
  return round2(total / bucket.length);
};

/**
 * Computes the severity trend of cases by comparing the average severity of
 * the last `window` cases against the average of the `window` cases right
 * before them. Both averages are rounded to 2 decimals. Direction is "sube"
 * when the recent average is higher, "baja" when lower, and "estable" when
 * equal or when there is no earlier bucket to compare against.
 * Pure and deterministic.
 */
export const computeSeverityTrend = (
  cases: readonly SeverityTrendCase[],
  options?: SeverityTrendOptions,
): SeverityTrendReport => {
  const requested = options?.window ?? DEFAULT_SEVERITY_WINDOW;
  const window = Math.max(1, Math.floor(requested));
  const total = cases.length;
  const recent = cases.slice(Math.max(0, total - window));
  const earlier = cases.slice(
    Math.max(0, total - window * 2),
    Math.max(0, total - window),
  );
  const recentAvg = averageSeverity(recent);
  const earlierAvg = averageSeverity(earlier);
  if (earlier.length === 0) {
    return { recentAvg, earlierAvg, direction: "estable" };
  }
  const direction =
    recentAvg > earlierAvg
      ? "sube"
      : recentAvg < earlierAvg
        ? "baja"
        : "estable";
  return { recentAvg, earlierAvg, direction };
};
