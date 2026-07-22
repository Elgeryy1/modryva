/**
 * Vitality state of a discussion topic.
 * - "muerto": too few messages to be considered alive.
 * - "conflictivo": enough activity but a high share of conflicts.
 * - "activo": healthy activity with few conflicts.
 * Pure and deterministic.
 */
export type TopicVitalityState = "muerto" | "activo" | "conflictivo";

/**
 * Raw activity metrics for a single topic.
 * `messages` and `conflicts` are non-negative counters.
 * Pure and deterministic.
 */
export interface TopicVitalityInput {
  readonly id: string;
  readonly messages: number;
  readonly conflicts: number;
}

/**
 * Classification result for a single topic, keyed by its id.
 * Pure and deterministic.
 */
export interface TopicVitalityEntry {
  readonly id: string;
  readonly state: TopicVitalityState;
}

/** Topics with this many messages or fewer are considered dead. */
const DEAD_MESSAGE_THRESHOLD = 2;

/** Conflict share (conflicts / messages) at or above this marks a topic as conflictive. */
const CONFLICT_RATIO_THRESHOLD = 0.3;

/**
 * Classifies each topic as "muerto", "conflictivo" or "activo", preserving
 * input order. A topic is "muerto" when it has DEAD_MESSAGE_THRESHOLD messages
 * or fewer (this also protects against division by zero). Otherwise it is
 * "conflictivo" when conflicts/messages is at least CONFLICT_RATIO_THRESHOLD,
 * and "activo" in every remaining case. Returns an empty array for empty input.
 * Pure and deterministic.
 */
export const classifyTopicVitality = (
  topics: readonly TopicVitalityInput[],
): readonly TopicVitalityEntry[] => {
  const result: TopicVitalityEntry[] = [];
  for (const topic of topics) {
    let state: TopicVitalityState;
    if (topic.messages <= DEAD_MESSAGE_THRESHOLD) {
      state = "muerto";
    } else if (topic.conflicts / topic.messages >= CONFLICT_RATIO_THRESHOLD) {
      state = "conflictivo";
    } else {
      state = "activo";
    }
    result.push({ id: topic.id, state });
  }
  return result;
};
