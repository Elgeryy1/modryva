/**
 * Latency reading for one bot module in milliseconds. Pure and deterministic.
 */
export interface ModuleLatency {
  readonly name: string;
  readonly latencyMs: number;
}

/** Options for detectHighLatency. */
export interface LatencyMonitorOptions {
  readonly thresholdMs?: number;
}

const DEFAULT_LATENCY_THRESHOLD_MS = 1000;

/**
 * Returns the modules whose latency strictly exceeds the threshold (default
 * 1000 ms), sorted by latency descending and then by name ascending. Does not
 * mutate the input. Pure and deterministic.
 */
export const detectHighLatency = (
  modules: readonly ModuleLatency[],
  options?: LatencyMonitorOptions,
): readonly ModuleLatency[] => {
  const thresholdMs = options?.thresholdMs ?? DEFAULT_LATENCY_THRESHOLD_MS;
  return modules
    .filter((entry) => entry.latencyMs > thresholdMs)
    .sort((a, b) => {
      if (b.latencyMs !== a.latencyMs) {
        return b.latencyMs - a.latencyMs;
      }
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
};
