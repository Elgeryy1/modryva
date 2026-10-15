/**
 * Verdict of a proportionality assessment between an applied sanction and the
 * expected sanction derived from gravity and recidivism. "proporcional" means
 * the sanction matches the expected level, "excesiva" means it is too harsh,
 * and "blanda" means it is too lenient.
 */
export type ProportionalityVerdict = "proporcional" | "excesiva" | "blanda";

/**
 * Raw inputs for a proportionality check. Every value is treated as a sanction
 * "level" or a count; non-finite or out-of-range values are normalized before
 * use, so callers never need to pre-validate.
 */
export interface ProportionalityInput {
  /** Sanction level actually applied by the moderator, expected in 0..5. */
  readonly sanctionLevel: number;
  /** Severity of the offense, expected in 0..5. */
  readonly gravity: number;
  /** Number of prior sanctioned offenses by the same user, expected >= 0. */
  readonly recidivism: number;
}

/**
 * Result of a proportionality assessment, ready to render in a moderation panel.
 * All numeric fields are normalized into the supported level range.
 */
export interface ProportionalityAssessment {
  /** Whether the applied sanction is proportional, too harsh, or too lenient. */
  readonly verdict: ProportionalityVerdict;
  /** Expected sanction level derived from gravity plus recidivism, in 0..5. */
  readonly expectedLevel: number;
  /** Applied sanction level after normalization, in 0..5. */
  readonly appliedLevel: number;
  /** appliedLevel minus expectedLevel: positive is harsher, negative is softer. */
  readonly delta: number;
  /** User-facing Spanish summary line for the moderation panel. */
  readonly summary: string;
}

const MIN_LEVEL = 0;
const MAX_LEVEL = 5;

/**
 * Rounds a value and clamps it into the [MIN_LEVEL, MAX_LEVEL] range. Non-finite
 * values collapse to MIN_LEVEL.
 */
const clampLevel = (value: number): number => {
  if (!Number.isFinite(value)) {
    return MIN_LEVEL;
  }
  const rounded = Math.round(value);
  if (rounded < MIN_LEVEL) {
    return MIN_LEVEL;
  }
  if (rounded > MAX_LEVEL) {
    return MAX_LEVEL;
  }
  return rounded;
};

/**
 * Normalizes a repeat-offense count to a non-negative integer. Non-finite values
 * collapse to zero.
 */
const normalizeCount = (value: number): number => {
  if (!Number.isFinite(value)) {
    return MIN_LEVEL;
  }
  const rounded = Math.round(value);
  return rounded < MIN_LEVEL ? MIN_LEVEL : rounded;
};

/** Builds the Spanish panel summary line for a verdict and its levels. */
const buildSummary = (
  verdict: ProportionalityVerdict,
  appliedLevel: number,
  expectedLevel: number,
): string => {
  if (verdict === "excesiva") {
    return `⚠️ Sanción excesiva: nivel ${appliedLevel} supera el ${expectedLevel} esperado.`;
  }
  if (verdict === "blanda") {
    return `🔽 Sanción blanda: nivel ${appliedLevel} por debajo del ${expectedLevel} esperado.`;
  }
  return `✅ Sanción proporcional: nivel ${appliedLevel} coincide con el ${expectedLevel} esperado.`;
};

/**
 * Assesses whether an applied sanction is proportional to the offense gravity
 * and the user's recidivism. The expected level is gravity plus one escalation
 * step per prior offense, clamped to 0..5, and is compared against the applied
 * level. Every input is normalized first, so out-of-range or non-finite values
 * are handled safely. Pure and deterministic.
 */
export const assessProportionality = (
  input: ProportionalityInput,
): ProportionalityAssessment => {
  const gravityLevel = clampLevel(input.gravity);
  const recidivismCount = normalizeCount(input.recidivism);
  const expectedLevel = clampLevel(gravityLevel + recidivismCount);
  const appliedLevel = clampLevel(input.sanctionLevel);
  const delta = appliedLevel - expectedLevel;
  const verdict: ProportionalityVerdict =
    delta > 0 ? "excesiva" : delta < 0 ? "blanda" : "proporcional";
  return {
    verdict,
    expectedLevel,
    appliedLevel,
    delta,
    summary: buildSummary(verdict, appliedLevel, expectedLevel),
  };
};
