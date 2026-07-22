/**
 * Signals for deciding whether a bot decision might be an error worth a human
 * review: the bot's confidence, whether the user disputes it, and whether the
 * bot already auto-actioned. Pure and deterministic.
 */
export interface BotErrorInput {
  readonly botConfidence: number;
  readonly userDisputes: boolean;
  readonly autoActioned: boolean;
}

/** Options for shouldEscalateBotError. */
export interface BotErrorEscalationOptions {
  readonly minConfidence?: number;
}

/**
 * Escalation verdict for a possible bot error, with a user-facing Spanish
 * reason. Pure and deterministic.
 */
export interface BotErrorEscalationResult {
  readonly escalate: boolean;
  readonly reason: string;
}

const DEFAULT_MIN_CONFIDENCE = 0.7;

/**
 * Escalates a possible bot error to a human when the bot auto-actioned, the
 * user disputes it, and the bot's confidence was below minConfidence (default
 * 0.7). Otherwise no escalation. The reason is user-facing Spanish.
 * Pure and deterministic.
 */
export const shouldEscalateBotError = (
  input: BotErrorInput,
  options?: BotErrorEscalationOptions,
): BotErrorEscalationResult => {
  const minConfidence = options?.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  const escalate =
    input.autoActioned &&
    input.userDisputes &&
    input.botConfidence < minConfidence;
  const reason = escalate
    ? "⚠️ Posible error del bot: acción automática con baja confianza y disputa del usuario. Revisión humana recomendada."
    : "Sin señales de error del bot que requieran escalado.";
  return { escalate, reason };
};
