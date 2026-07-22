/** The current Telegram API error rate (0..1). Pure and deterministic. */
export interface ReadOnlyInput {
  readonly apiErrorRate: number;
}

/** Options for decideReadOnly. */
export interface ReadOnlyOptions {
  readonly threshold?: number;
}

/**
 * Whether the bot should drop into read-only mode, with a user-facing Spanish
 * reason. Pure and deterministic.
 */
export interface ReadOnlyDecision {
  readonly readOnly: boolean;
  readonly reason: string;
}

/**
 * Decides whether to switch to read-only mode when the Telegram API is
 * misbehaving: read-only engages once the error rate reaches the threshold
 * (default 0.5). Pure and deterministic.
 */
export const decideReadOnly = (
  input: ReadOnlyInput,
  options?: ReadOnlyOptions,
): ReadOnlyDecision => {
  const threshold = options?.threshold ?? 0.5;
  const readOnly = input.apiErrorRate >= threshold;
  return {
    readOnly,
    reason: readOnly
      ? "Modo solo lectura: la API de Telegram falla demasiado."
      : "API estable: modo normal.",
  };
};
