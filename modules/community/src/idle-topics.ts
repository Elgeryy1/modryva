/**
 * A section/topic together with the epoch-millisecond timestamp of its most
 * recent activity. Plain data, no side effects.
 */
export interface TopicActivity {
  readonly id: string;
  readonly lastActivityMs: number;
}

/**
 * A topic flagged as dead, paired with how long it has been idle in
 * milliseconds (nowMs - lastActivityMs). Plain data, no side effects.
 */
export interface DeadTopic {
  readonly id: string;
  readonly idleMs: number;
}

/**
 * Options for detectIdleTopics. deadAfterMs is the idle threshold: a topic is
 * dead once it has been idle for at least this many milliseconds. When omitted,
 * DEFAULT_DEAD_AFTER_MS is used.
 */
export interface DetectDeadTopicsOptions {
  readonly deadAfterMs?: number;
}

/**
 * Default idle threshold: seven days expressed in milliseconds. A topic idle for
 * at least this long is considered dead. Pure and deterministic.
 */
export const DEFAULT_DEAD_AFTER_MS: number = 7 * 24 * 60 * 60 * 1000;

/**
 * Detects dead topics: sections that no longer generate activity. A topic is
 * dead when its idle time (nowMs - lastActivityMs) is greater than or equal to
 * deadAfterMs (defaults to DEFAULT_DEAD_AFTER_MS). The result contains only dead
 * topics, sorted by idleMs descending, with ties broken by original input order.
 * Never mutates its inputs. Pure and deterministic.
 */
export const detectIdleTopics = (
  topics: readonly TopicActivity[],
  nowMs: number,
  options?: DetectDeadTopicsOptions,
): readonly DeadTopic[] => {
  const deadAfterMs = options?.deadAfterMs ?? DEFAULT_DEAD_AFTER_MS;
  const dead: {
    readonly id: string;
    readonly idleMs: number;
    readonly order: number;
  }[] = [];
  let order = 0;
  for (const topic of topics) {
    const idleMs = nowMs - topic.lastActivityMs;
    if (idleMs >= deadAfterMs) {
      dead.push({ id: topic.id, idleMs, order });
    }
    order += 1;
  }
  dead.sort((a, b) => {
    if (b.idleMs !== a.idleMs) {
      return b.idleMs - a.idleMs;
    }
    return a.order - b.order;
  });
  return dead.map((entry) => ({ id: entry.id, idleMs: entry.idleMs }));
};
