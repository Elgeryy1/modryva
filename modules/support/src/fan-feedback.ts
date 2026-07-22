/**
 * A single piece of fan feedback, classified by its sentiment.
 * Pure data, no behavior. Pure and deterministic.
 */
export interface FanFeedbackItem {
  readonly sentiment: "positivo" | "neutro" | "negativo";
}

/**
 * Aggregated summary of a batch of fan feedback.
 * netScore is positive minus negative (neutral is ignored). Pure and deterministic.
 */
export interface FanFeedbackSummary {
  readonly total: number;
  readonly positive: number;
  readonly neutral: number;
  readonly negative: number;
  readonly netScore: number;
}

/**
 * Summarizes a batch of fan feedback into counts per sentiment plus a net score.
 * Unknown or missing sentiments are ignored so total may be lower than the input
 * length only when items are malformed; well-typed input always sums exactly.
 * netScore = positive - negative. Empty input yields all zeros.
 * Pure and deterministic.
 */
export const summarizeFanFeedback = (
  feedback: readonly FanFeedbackItem[],
): FanFeedbackSummary => {
  let positive = 0;
  let neutral = 0;
  let negative = 0;
  for (const item of feedback) {
    if (item.sentiment === "positivo") {
      positive += 1;
    } else if (item.sentiment === "neutro") {
      neutral += 1;
    } else if (item.sentiment === "negativo") {
      negative += 1;
    }
  }
  return {
    total: positive + neutral + negative,
    positive,
    neutral,
    negative,
    netScore: positive - negative,
  };
};
