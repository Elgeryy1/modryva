/** A decided case with the confidence of its decision. Pure and deterministic. */
export interface ReviewCase {
  readonly id: string;
  readonly confidence: number;
}

/** A decision flagged as doubtful for weekly review. Pure and deterministic. */
export interface DoubtfulDecision {
  readonly id: string;
  readonly confidence: number;
}

/** Options for collectDoubtfulDecisions. */
export interface DecisionReviewOptions {
  readonly threshold?: number;
}

const DEFAULT_DOUBT_THRESHOLD = 0.6;

/**
 * Collects decisions worth a weekly review: those whose confidence is below the
 * threshold (default 0.6). Sorted by confidence ascending (most doubtful first),
 * then id ascending. Pure and deterministic.
 */
export const collectDoubtfulDecisions = (
  cases: readonly ReviewCase[],
  options?: DecisionReviewOptions,
): readonly DoubtfulDecision[] => {
  const threshold = options?.threshold ?? DEFAULT_DOUBT_THRESHOLD;
  return cases
    .filter((item) => item.confidence < threshold)
    .map((item) => ({ id: item.id, confidence: item.confidence }))
    .sort((a, b) => {
      if (a.confidence !== b.confidence) {
        return a.confidence - b.confidence;
      }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
};
