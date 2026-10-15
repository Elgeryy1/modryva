/**
 * Default delay before asking a resolved-ticket follow-up: 24 hours in milliseconds.
 * Pure and deterministic.
 */
export const DEFAULT_TICKET_FOLLOWUP_DELAY_MS = 24 * 60 * 60 * 1000;

/**
 * User-facing follow-up question sent after a ticket is marked as resolved.
 * Spanish copy with correct accents and punctuation.
 */
export const TICKET_FOLLOWUP_MESSAGE =
  "¡Hola! ¿Quedó solucionado tu problema? Si aún necesitas ayuda, responde a este mensaje y reabrimos tu ticket. 🙌";

/**
 * Options for the ticket follow-up decision. delayMs overrides the default 24h wait.
 * Pure and deterministic.
 */
export interface TicketFollowupOptions {
  readonly delayMs?: number;
}

/**
 * Result of evaluating whether a resolved-ticket follow-up should be sent now.
 * `send` is true once enough time has elapsed; `message` is the question to deliver;
 * `elapsedMs` is how long ago the ticket was resolved (clamped to zero, never negative).
 * Pure and deterministic.
 */
export interface TicketFollowupDecision {
  readonly send: boolean;
  readonly message: string;
  readonly elapsedMs: number;
}

/**
 * Decides if the post-resolution follow-up question should be sent at nowMs,
 * given when the ticket was resolved. Sends when nowMs - resolvedMs >= delayMs
 * (default 24h). A non-positive or non-finite delay makes the follow-up due as
 * soon as any time has passed (elapsedMs >= 0). Future resolvedMs yields elapsedMs 0
 * and send false. Pure and deterministic.
 */
export const shouldSendTicketFollowup = (
  resolvedMs: number,
  nowMs: number,
  options?: TicketFollowupOptions,
): TicketFollowupDecision => {
  const rawDelay = options?.delayMs;
  const delayMs =
    rawDelay !== undefined && Number.isFinite(rawDelay)
      ? rawDelay
      : DEFAULT_TICKET_FOLLOWUP_DELAY_MS;
  const rawElapsed = nowMs - resolvedMs;
  const elapsedMs = rawElapsed > 0 ? rawElapsed : 0;
  const send = elapsedMs >= delayMs;
  return { send, message: TICKET_FOLLOWUP_MESSAGE, elapsedMs };
};
