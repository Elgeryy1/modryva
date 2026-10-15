/**
 * Default escalation threshold in milliseconds (15 minutes). If no admin
 * responds to a critical alert within this window, the alert escalates to the
 * owner. Pure and deterministic.
 */
export const DEFAULT_ESCALATION_THRESHOLD_MS = 15 * 60 * 1000;

/**
 * Snapshot describing a single critical alert and the current time. All values
 * are epoch milliseconds. `lastAdminResponseMs` is undefined when no admin has
 * responded at all since the bot started tracking. Pure and deterministic.
 */
export interface EscalationInput {
  /** Epoch ms when the critical alert was raised. */
  readonly alertMs: number;
  /** Current epoch ms, injected by the caller (never read from the clock here). */
  readonly nowMs: number;
  /** Epoch ms of the last admin response, or undefined if none. */
  readonly lastAdminResponseMs: number | undefined;
}

/**
 * Tuning options for the escalation decision. Pure and deterministic.
 */
export interface EscalationOptions {
  /** Overrides DEFAULT_ESCALATION_THRESHOLD_MS. */
  readonly thresholdMs?: number;
}

/**
 * Result of an escalation evaluation. `waitedMs` is how long the alert has been
 * open (nowMs - alertMs), which may be negative under clock skew. Pure and
 * deterministic.
 */
export interface EscalationDecision {
  /** True when the alert must be escalated to the owner. */
  readonly escalate: boolean;
  /** Milliseconds elapsed since the alert was raised. */
  readonly waitedMs: number;
}

/**
 * Decides whether a critical alert should escalate to the owner. An alert
 * escalates when no admin has responded AFTER it was raised and it has been
 * open for at least the threshold. A response strictly before the alert time is
 * treated as stale and does not count. Pure and deterministic.
 */
export const shouldEscalateToOwner = (
  input: EscalationInput,
  options: EscalationOptions = {},
): EscalationDecision => {
  const thresholdMs = options.thresholdMs ?? DEFAULT_ESCALATION_THRESHOLD_MS;
  const waitedMs = input.nowMs - input.alertMs;
  const responded =
    input.lastAdminResponseMs !== undefined &&
    input.lastAdminResponseMs >= input.alertMs;
  const escalate = !responded && waitedMs >= thresholdMs;
  return { escalate, waitedMs };
};

/**
 * Builds the Spanish notice sent to the owner when an alert escalates. Negative
 * or fractional waits are floored to whole minutes and clamped at zero. Pure
 * and deterministic.
 */
export const formatEscalationNotice = (params: {
  readonly ownerMention: string;
  readonly waitedMs: number;
}): string => {
  const minutes = Math.max(0, Math.floor(params.waitedMs / 60000));
  return `🚨 Escalando al owner ${params.ownerMention}: ningún administrador respondió a la alerta crítica tras ${minutes} min de espera.`;
};
