/**
 * Confidence band for a decision that was taken, ordered from least to most
 * confident. Note this scores the DECISION, not the user it targets.
 * Pure and deterministic.
 */
export type ConfidenceBand = "baja" | "media" | "alta";

/**
 * Inputs describing how well-supported a taken decision is.
 *
 * - evidenceCount: number of independent evidence items backing the decision.
 *   Clamped to 0..EVIDENCE_SATURATION; evidence beyond saturation adds nothing.
 * - precedentMatch: whether the decision follows an established precedent.
 * - staffAgreement: fraction of staff who agree, expressed in 0..1. Values
 *   outside that range (or non-finite) are clamped.
 *
 * Pure and deterministic.
 */
export interface DecisionConfidenceInput {
  readonly evidenceCount: number;
  readonly precedentMatch: boolean;
  readonly staffAgreement: number;
}

/**
 * Result of scoring a decision: an integer score in 0..100 and its band.
 * Pure and deterministic.
 */
export interface DecisionConfidenceResult {
  readonly score: number;
  readonly band: ConfidenceBand;
}

/** Evidence items beyond this count add no extra confidence. */
const EVIDENCE_SATURATION = 5;
/** Maximum points contributed by evidence. */
const EVIDENCE_WEIGHT = 40;
/** Points contributed by matching an established precedent. */
const PRECEDENT_WEIGHT = 25;
/** Maximum points contributed by full staff agreement. */
const AGREEMENT_WEIGHT = 35;
/** Minimum score required for the "alta" band. */
const ALTA_MIN_SCORE = 70;
/** Minimum score required for the "media" band. */
const MEDIA_MIN_SCORE = 40;

/**
 * Clamps value into [min, max], returning min for non-finite input (NaN,
 * Infinity). Internal helper.
 */
const clampFinite = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};

/** Maps an integer score to its confidence band. Internal helper. */
const bandForScore = (score: number): ConfidenceBand => {
  if (score >= ALTA_MIN_SCORE) {
    return "alta";
  }
  if (score >= MEDIA_MIN_SCORE) {
    return "media";
  }
  return "baja";
};

/**
 * Scores how confident we should be in a decision that was taken, based on the
 * evidence backing it, whether it follows precedent, and how much staff agree.
 * Evidence contributes up to EVIDENCE_WEIGHT points (saturating at
 * EVIDENCE_SATURATION items), a precedent match adds PRECEDENT_WEIGHT points,
 * and staff agreement contributes up to AGREEMENT_WEIGHT points. The weighted
 * sum is rounded to an integer in 0..100 and bucketed into a band. Inputs are
 * clamped and guarded against non-finite values, so the same input always
 * yields the same result. Pure and deterministic.
 */
export const scoreDecisionConfidence = (
  input: DecisionConfidenceInput,
): DecisionConfidenceResult => {
  const evidence = clampFinite(input.evidenceCount, 0, EVIDENCE_SATURATION);
  const agreement = clampFinite(input.staffAgreement, 0, 1);

  const evidencePoints = (evidence / EVIDENCE_SATURATION) * EVIDENCE_WEIGHT;
  const precedentPoints = input.precedentMatch ? PRECEDENT_WEIGHT : 0;
  const agreementPoints = agreement * AGREEMENT_WEIGHT;

  const score = Math.round(evidencePoints + precedentPoints + agreementPoints);

  return { score, band: bandForScore(score) };
};
