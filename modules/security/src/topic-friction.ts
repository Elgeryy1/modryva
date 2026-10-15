/**
 * Historical conflict-risk input for a single conversation topic.
 * `conflicts` is the number of moderated incidents tied to the topic,
 * `mentions` is how many times the topic has appeared.
 * Pure and deterministic.
 */
export interface TopicFrictionInput {
  readonly topic: string;
  readonly conflicts: number;
  readonly mentions: number;
}

/**
 * Friction categories, ordered from least to most risky.
 * Pure and deterministic.
 */
export type TopicFrictionLevel = "bajo" | "medio" | "alto";

/**
 * Computed friction score for a single topic.
 * `friction` is the conflict ratio rounded to 2 decimals (0 when there are no mentions).
 * Pure and deterministic.
 */
export interface TopicFrictionScore {
  readonly topic: string;
  readonly friction: number;
  readonly level: TopicFrictionLevel;
}

const MEDIO_THRESHOLD = 0.2;
const ALTO_THRESHOLD = 0.5;

/** Rounds a ratio to 2 decimals without floating drift. Pure and deterministic. */
const roundFriction = (value: number): number => Math.round(value * 100) / 100;

/** Maps a friction ratio to its risk level via fixed thresholds. Pure and deterministic. */
const levelForFriction = (friction: number): TopicFrictionLevel => {
  if (friction >= ALTO_THRESHOLD) {
    return "alto";
  }
  if (friction >= MEDIO_THRESHOLD) {
    return "medio";
  }
  return "bajo";
};

/**
 * Scores each topic by its historical friction ratio (conflicts / mentions),
 * rounded to 2 decimals. Topics without mentions score 0 to avoid division by zero.
 * Results are sorted by friction descending, breaking ties by topic name ascending.
 * The input array is not mutated. Pure and deterministic.
 */
export const computeTopicFriction = (
  topics: readonly TopicFrictionInput[],
): readonly TopicFrictionScore[] => {
  const scored: TopicFrictionScore[] = topics.map((entry) => {
    const friction =
      entry.mentions > 0 ? roundFriction(entry.conflicts / entry.mentions) : 0;
    return {
      topic: entry.topic,
      friction,
      level: levelForFriction(friction),
    };
  });
  return scored.sort((a, b) => {
    if (b.friction !== a.friction) {
      return b.friction - a.friction;
    }
    return a.topic < b.topic ? -1 : a.topic > b.topic ? 1 : 0;
  });
};
