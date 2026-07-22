/**
 * Input for the human-escalation decision: the assessed severity of the
 * case and how confident the bot is in handling it automatically.
 * Pure and deterministic.
 */
export interface HumanEscalationInput {
  readonly severity: number;
  readonly botConfidence: number;
}

/**
 * Optional thresholds overriding the defaults. maxSeverityForBot is the
 * highest severity the bot may still handle on its own; minConfidence is
 * the lowest confidence the bot may still act with. Pure and deterministic.
 */
export interface HumanEscalationOptions {
  readonly maxSeverityForBot?: number;
  readonly minConfidence?: number;
}

/**
 * Result of the escalation decision: whether to hand the case to a human
 * and a user-facing Spanish reason explaining why. Pure and deterministic.
 */
export interface HumanEscalationDecision {
  readonly escalate: boolean;
  readonly reason: string;
}

/** Default highest severity the bot may handle without a human. Pure and deterministic. */
const DEFAULT_MAX_SEVERITY_FOR_BOT = 3;

/** Default lowest confidence the bot may act with without a human. Pure and deterministic. */
const DEFAULT_MIN_CONFIDENCE = 0.6;

/**
 * Decides whether a case must be escalated to a human agent based on its
 * gravity. Escalates when severity exceeds maxSeverityForBot (default 3)
 * OR botConfidence falls below minConfidence (default 0.6). The reason is
 * a user-facing Spanish message tailored to which condition triggered.
 * Pure and deterministic.
 */
export const decideHumanEscalation = (
  input: HumanEscalationInput,
  options?: HumanEscalationOptions,
): HumanEscalationDecision => {
  const maxSeverityForBot =
    options?.maxSeverityForBot ?? DEFAULT_MAX_SEVERITY_FOR_BOT;
  const minConfidence = options?.minConfidence ?? DEFAULT_MIN_CONFIDENCE;

  const severityTooHigh = input.severity > maxSeverityForBot;
  const confidenceTooLow = input.botConfidence < minConfidence;

  if (severityTooHigh && confidenceTooLow) {
    return {
      escalate: true,
      reason: "⚠️ Gravedad alta y confianza baja: derivando a un agente humano.",
    };
  }
  if (severityTooHigh) {
    return {
      escalate: true,
      reason: "⚠️ Gravedad alta: derivando a un agente humano.",
    };
  }
  if (confidenceTooLow) {
    return {
      escalate: true,
      reason: "⚠️ Confianza insuficiente: derivando a un agente humano.",
    };
  }
  return {
    escalate: false,
    reason: "✅ El bot puede resolver este caso automáticamente.",
  };
};
