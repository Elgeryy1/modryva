/**
 * Conflict statistics for a single discussion topic in a group.
 * threadCount is how many threads/hilos touched the topic; conflictCount is how
 * many of them escalated into a conflict.
 * Pure and deterministic.
 */
export interface TopicConflictStats {
  readonly topic: string;
  readonly conflictCount: number;
  readonly threadCount: number;
}

/**
 * Tuning options for the cursed-topic detector.
 * minRate is the minimum conflict rate to flag (default 0.5).
 * minThreads is the minimum sample size of threads required (default 3).
 * Pure and deterministic.
 */
export interface CursedTopicOptions {
  readonly minRate?: number;
  readonly minThreads?: number;
}

/**
 * A topic flagged as "cursed" because it reliably breeds conflict.
 * conflictRate is conflictCount/threadCount rounded to 2 decimals.
 * Pure and deterministic.
 */
export interface CursedTopic {
  readonly topic: string;
  readonly conflictRate: number;
}

const DEFAULT_MIN_RATE = 0.5;
const DEFAULT_MIN_THREADS = 3;

/**
 * Rounds a ratio to 2 decimals. Pure and deterministic.
 */
const roundRate = (value: number): number => Math.round(value * 100) / 100;

/**
 * Detects "cursed topics": subjects that keep generating conflict in a group.
 * A topic is included when it has at least minThreads threads (and a positive
 * thread count) and a rounded conflict rate of at least minRate. Results are
 * sorted by conflictRate descending, breaking ties by topic ascending.
 * The input is never mutated.
 * Pure and deterministic.
 */
export const detectCursedTopics = (
  topics: readonly TopicConflictStats[],
  options?: CursedTopicOptions,
): readonly CursedTopic[] => {
  const minRate = options?.minRate ?? DEFAULT_MIN_RATE;
  const minThreads = options?.minThreads ?? DEFAULT_MIN_THREADS;
  const cursed: CursedTopic[] = [];
  for (const entry of topics) {
    if (entry.threadCount <= 0 || entry.threadCount < minThreads) {
      continue;
    }
    const conflictRate = roundRate(entry.conflictCount / entry.threadCount);
    if (conflictRate < minRate) {
      continue;
    }
    cursed.push({ topic: entry.topic, conflictRate });
  }
  cursed.sort((a, b) => {
    if (b.conflictRate !== a.conflictRate) {
      return b.conflictRate - a.conflictRate;
    }
    if (a.topic < b.topic) {
      return -1;
    }
    if (a.topic > b.topic) {
      return 1;
    }
    return 0;
  });
  return cursed;
};
