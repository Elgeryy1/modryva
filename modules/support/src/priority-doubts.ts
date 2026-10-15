/**
 * A pending doubt (a question raised in a chat) that can be prioritized so it
 * does not get lost in the flow of the conversation.
 */
export interface DoubtInput {
  /** Stable unique identifier of the doubt. */
  readonly id: string;
  /** Whether the author or an admin flagged the doubt as urgent. */
  readonly urgent: boolean;
  /** How long the doubt has been waiting, in milliseconds. Negative values are treated as zero. */
  readonly ageMs: number;
  /** Number of community upvotes. Negative values are treated as zero. */
  readonly upvotes: number;
}

/**
 * A doubt paired with its computed priority score. A higher score means the
 * doubt should surface first.
 */
export interface RankedDoubt {
  /** Identifier copied from the input doubt. */
  readonly id: string;
  /** Non-negative priority score; higher surfaces first. */
  readonly priority: number;
}

// Fixed bonus applied when a doubt is flagged as urgent.
const URGENT_WEIGHT = 1000;
// Points added per community upvote.
const UPVOTE_WEIGHT = 10;
// Points added per full hour the doubt has been waiting.
const AGE_WEIGHT_PER_HOUR = 1;
// Milliseconds contained in one hour.
const HOUR_MS = 3_600_000;

/**
 * Computes the non-negative priority score of a single doubt from its urgency,
 * waiting age (counted in full hours) and upvotes. Negative age or upvotes are
 * clamped to zero, so a doubt can never be pushed below the baseline.
 * Pure and deterministic.
 */
export const scoreDoubt = (doubt: DoubtInput): number => {
  const urgentScore = doubt.urgent ? URGENT_WEIGHT : 0;
  const upvotes = doubt.upvotes > 0 ? doubt.upvotes : 0;
  const ageMs = doubt.ageMs > 0 ? doubt.ageMs : 0;
  const ageHours = Math.floor(ageMs / HOUR_MS);
  return urgentScore + upvotes * UPVOTE_WEIGHT + ageHours * AGE_WEIGHT_PER_HOUR;
};

/**
 * Ranks doubts so the most important ones surface first: by priority score
 * descending, breaking ties by id ascending (lexicographic). Returns a new
 * array and never mutates the input. Empty input yields an empty array.
 * Pure and deterministic.
 */
export const rankDoubts = (
  doubts: readonly DoubtInput[],
): readonly RankedDoubt[] => {
  const ranked: RankedDoubt[] = doubts.map(
    (doubt): RankedDoubt => ({
      id: doubt.id,
      priority: scoreDoubt(doubt),
    }),
  );
  return ranked.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    if (a.id < b.id) {
      return -1;
    }
    if (a.id > b.id) {
      return 1;
    }
    return 0;
  });
};
