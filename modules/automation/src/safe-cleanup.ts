/** A background job with its creation time. Pure and deterministic. */
export interface CleanupJob {
  readonly id: string;
  readonly createdMs: number;
}

/** Options for selectOldJobsForCleanup. */
export interface SafeCleanupOptions {
  readonly maxAgeMs?: number;
}

const DEFAULT_JOB_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Selects the ids of jobs old enough to clean up: those whose age
 * (nowMs - createdMs) is at least maxAgeMs (default 30 days). Input order is
 * preserved. Pure and deterministic.
 */
export const selectOldJobsForCleanup = (
  jobs: readonly CleanupJob[],
  nowMs: number,
  options?: SafeCleanupOptions,
): readonly string[] => {
  const maxAgeMs = options?.maxAgeMs ?? DEFAULT_JOB_MAX_AGE_MS;
  return jobs
    .filter((job) => nowMs - job.createdMs >= maxAgeMs)
    .map((job) => job.id);
};
