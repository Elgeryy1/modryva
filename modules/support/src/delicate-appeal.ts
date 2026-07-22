/**
 * Input flags describing what an appeal touches on, used to decide whether it
 * must be handled with extra care. Pure and deterministic.
 */
export interface DelicateAppealInput {
  /** Whether the appeal mentions a minor. */
  readonly mentionsMinor: boolean;
  /** Whether the appeal raises a legal matter. */
  readonly mentionsLegal: boolean;
  /** Whether the appeal mentions self-harm. */
  readonly mentionsSelfHarm: boolean;
}

/**
 * Result of assessing an appeal: whether it is delicate plus the user-facing
 * Spanish reasons that made it so, in a fixed order. Pure and deterministic.
 */
export interface DelicateAppealAssessment {
  /** True when at least one delicate flag is set. */
  readonly delicate: boolean;
  /** User-facing Spanish reason labels, in fixed order, empty when not delicate. */
  readonly reasons: readonly string[];
}

const MINOR_REASON = "Menciona a una persona menor de edad 🚸";
const LEGAL_REASON = "Plantea una cuestion legal ⚖️";
const SELF_HARM_REASON = "Indica riesgo de autolesion ❤️";

/**
 * Marks an appeal as delicate when it mentions a minor, a legal matter, or
 * self-harm. Reasons are appended in a fixed order (menor, legal, autolesion)
 * so the output is stable regardless of caller flag order. Pure and deterministic.
 */
export const markDelicateAppeal = (
  input: DelicateAppealInput,
): DelicateAppealAssessment => {
  const reasons: string[] = [];
  if (input.mentionsMinor) {
    reasons.push(MINOR_REASON);
  }
  if (input.mentionsLegal) {
    reasons.push(LEGAL_REASON);
  }
  if (input.mentionsSelfHarm) {
    reasons.push(SELF_HARM_REASON);
  }
  return { delicate: reasons.length > 0, reasons };
};
