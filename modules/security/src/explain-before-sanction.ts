/**
 * Input for {@link buildSanctionRationale}: the rule that was broken, the
 * proposed action, how many prior warnings the user already has, and a
 * confidence score in the range 0..1.
 */
export interface SanctionRationaleInput {
  /** Human-readable name of the rule that was broken. */
  readonly rule: string;
  /** Proposed moderation action (for example "silenciar" or "expulsar"). */
  readonly action: string;
  /** Count of prior warnings for this user; negatives are treated as zero. */
  readonly priorWarns: number;
  /** Confidence score in 0..1; values outside the range are clamped. */
  readonly confidence: number;
}

/** Fallback rule label when the caller provides an empty rule. */
const RULE_FALLBACK = "una norma del grupo";

/** Fallback action label when the caller provides an empty action. */
const ACTION_FALLBACK = "revisar el caso";

/** Trims a label and substitutes a fallback when it is blank. */
const cleanLabel = (value: string, fallback: string): string => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

/** Clamps a confidence score into the closed interval 0..1, treating non-finite as 0. */
const clampConfidence = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
};

/** Normalizes prior warnings to a non-negative integer, treating non-finite as 0. */
const normalizePriors = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
};

/** Renders the prior-warnings count as a grammatical Spanish phrase. */
const priorsPhrase = (priors: number): string => {
  if (priors <= 0) {
    return "sin avisos previos";
  }
  if (priors === 1) {
    return "1 aviso previo";
  }
  return `${priors} avisos previos`;
};

/** Maps a clamped confidence score to a qualitative Spanish level. */
const confidenceLevel = (confidence: number): string => {
  if (confidence >= 0.8) {
    return "alta";
  }
  if (confidence >= 0.5) {
    return "media";
  }
  return "baja";
};

/**
 * Builds a two-line Spanish rationale that Modryva can show before applying a
 * sanction. The first line names the rule that was broken; the second explains
 * why the action fits, citing prior warnings and the confidence level. Blank
 * rule/action fall back to generic labels, priors below zero become zero, and
 * confidence is clamped to 0..1. Lines are joined by a single newline.
 * Pure and deterministic.
 */
export const buildSanctionRationale = (
  input: SanctionRationaleInput,
): string => {
  const rule = cleanLabel(input.rule, RULE_FALLBACK);
  const action = cleanLabel(input.action, ACTION_FALLBACK);
  const priors = normalizePriors(input.priorWarns);
  const confidence = clampConfidence(input.confidence);
  const pct = Math.round(confidence * 100);
  const line1 = `📋 Motivo: se infringió la regla "${rule}".`;
  const line2 = `⚖️ Propongo ${action}: ${priorsPhrase(priors)} y confianza ${confidenceLevel(confidence)} (${pct}%).`;
  return `${line1}\n${line2}`;
};
