/**
 * Tuning options for {@link detectInflation}.
 * Pure and deterministic.
 */
export interface InflationOptions {
  /**
   * Minimum fractional growth (e.g. 0.2 means +20%) that must be strictly
   * exceeded for the virtual supply to be flagged as inflating. Defaults to 0.2.
   */
  readonly growthThreshold?: number;
}

/**
 * Outcome of an inflation check over a virtual supply-history window.
 * Pure and deterministic.
 */
export interface InflationReport {
  /** True when the growth rate is strictly above the configured threshold. */
  readonly inflating: boolean;
  /** Fractional change from the first to the last sample: (last - first) / first. */
  readonly growthRate: number;
}

/** Default growth threshold (+20%) applied when no option is provided. Pure and deterministic. */
const DEFAULT_GROWTH_THRESHOLD = 0.2;

/**
 * Detects virtual-currency inflation by comparing the first and last samples of a
 * supply-history window. The growth rate is (last - first) / first, and the supply
 * is flagged as inflating when that rate is strictly greater than the threshold
 * (default 0.2). Returns a growth rate of 0 and inflating=false when there are
 * fewer than two samples or when the first sample is 0 (the ratio is undefined).
 * Pure and deterministic.
 */
export const detectInflation = (
  supplyHistory: readonly number[],
  options?: InflationOptions,
): InflationReport => {
  const threshold = options?.growthThreshold ?? DEFAULT_GROWTH_THRESHOLD;
  if (supplyHistory.length < 2) {
    return { inflating: false, growthRate: 0 };
  }
  const first = supplyHistory[0] ?? 0;
  const last = supplyHistory[supplyHistory.length - 1] ?? 0;
  if (first === 0) {
    return { inflating: false, growthRate: 0 };
  }
  const growthRate = (last - first) / first;
  return { inflating: growthRate > threshold, growthRate };
};
