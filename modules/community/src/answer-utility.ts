/**
 * A single answer contribution by an author, flagged helpful or not.
 * Pure data input for the answer-utility index.
 */
export interface AnswerRecord {
  readonly authorId: number;
  readonly helpful: boolean;
}

/**
 * Aggregated utility index for one author: how many of their answers were
 * marked helpful, the total they gave, and the resulting utility ratio.
 */
export interface AnswerUtility {
  readonly authorId: number;
  readonly helpful: number;
  readonly total: number;
  readonly utility: number;
}

/**
 * Rounds a ratio to at most two decimal places using half-up rounding.
 * Returns 0 when total is 0 to avoid division by zero.
 * Pure and deterministic.
 */
const ratioTwoDecimals = (helpful: number, total: number): number => {
  if (total === 0) {
    return 0;
  }
  return Math.round((helpful / total) * 100) / 100;
};

/**
 * Computes a per-author utility index from a flat list of answer records.
 * Tallies helpful and total counts per authorId, derives utility as
 * helpful/total rounded to two decimals, and returns rows sorted by utility
 * descending, breaking ties by helpful count descending and then authorId
 * ascending. An empty input yields an empty result.
 * Pure and deterministic.
 */
export const computeAnswerUtility = (
  answers: readonly AnswerRecord[],
): readonly AnswerUtility[] => {
  const tally = new Map<number, { helpful: number; total: number }>();
  for (const answer of answers) {
    const current = tally.get(answer.authorId) ?? { helpful: 0, total: 0 };
    tally.set(answer.authorId, {
      helpful: current.helpful + (answer.helpful ? 1 : 0),
      total: current.total + 1,
    });
  }

  const rows: AnswerUtility[] = [];
  for (const [authorId, counts] of tally) {
    rows.push({
      authorId,
      helpful: counts.helpful,
      total: counts.total,
      utility: ratioTwoDecimals(counts.helpful, counts.total),
    });
  }

  rows.sort((a, b) => {
    if (b.utility !== a.utility) {
      return b.utility - a.utility;
    }
    if (b.helpful !== a.helpful) {
      return b.helpful - a.helpful;
    }
    return a.authorId - b.authorId;
  });

  return rows;
};
