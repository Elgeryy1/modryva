/**
 * A single external dependency the bot relies on (e.g. Telegram API,
 * database, cache) together with its current health flag.
 */
export interface ExternalDep {
  /** Human-readable service name shown in the panel. */
  readonly name: string;
  /** True when the service is reachable and operating normally. */
  readonly healthy: boolean;
}

/**
 * Aggregated health view of every external dependency the bot depends on.
 */
export interface ExternalDepsSummary {
  /** Total number of dependencies inspected. */
  readonly total: number;
  /** Number of dependencies currently down (not healthy). */
  readonly downCount: number;
  /** Names of the unhealthy dependencies, preserving input order. */
  readonly down: readonly string[];
  /** True when no dependency is down (also true for an empty input). */
  readonly allHealthy: boolean;
}

/**
 * Summarizes the health of the bot's external dependencies for a status panel.
 * Names of unhealthy deps are collected in input order (duplicates preserved).
 * An empty input yields an all-healthy summary with an empty down list.
 * Pure and deterministic.
 */
export const summarizeExternalDeps = (
  deps: readonly ExternalDep[],
): ExternalDepsSummary => {
  const down: string[] = [];
  for (const dep of deps) {
    if (!dep.healthy) {
      down.push(dep.name);
    }
  }
  return {
    total: deps.length,
    downCount: down.length,
    down,
    allHealthy: down.length === 0,
  };
};
