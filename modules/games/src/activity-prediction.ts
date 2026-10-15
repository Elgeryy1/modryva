/** A member's prediction of a future activity number. Pure and deterministic. */
export interface ActivityPrediction {
  readonly userId: number;
  readonly predicted: number;
}

/** Options for resolveActivityPrediction. */
export interface ActivityPredictionOptions {
  readonly tolerance?: number;
}

/**
 * Outcome for one prediction: the absolute error and whether it won.
 * Pure and deterministic.
 */
export interface ActivityPredictionOutcome {
  readonly userId: number;
  readonly diff: number;
  readonly won: boolean;
}

const DEFAULT_ACTIVITY_TOLERANCE = 5;

/**
 * Resolves activity predictions against the actual value. A prediction wins
 * when its absolute error is within tolerance (default 5). Outcomes are sorted
 * by error ascending, then userId ascending. Pure and deterministic.
 */
export const resolveActivityPrediction = (
  predictions: readonly ActivityPrediction[],
  actual: number,
  options?: ActivityPredictionOptions,
): readonly ActivityPredictionOutcome[] => {
  const tolerance = options?.tolerance ?? DEFAULT_ACTIVITY_TOLERANCE;
  return predictions
    .map((prediction) => {
      const diff = Math.abs(prediction.predicted - actual);
      return { userId: prediction.userId, diff, won: diff <= tolerance };
    })
    .sort((a, b) => {
      if (a.diff !== b.diff) {
        return a.diff - b.diff;
      }
      return a.userId - b.userId;
    });
};
