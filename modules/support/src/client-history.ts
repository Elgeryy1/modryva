/**
 * Ticket status values tracked for a client's support history.
 * Pure and deterministic.
 */
export type SupportTicketStatus = "abierto" | "resuelto" | "cerrado";

/**
 * A single support ticket belonging to a client, identified elsewhere by
 * Telegram ID. Only the status is needed to build the summary.
 * Pure and deterministic.
 */
export interface ClientHistoryTicket {
  readonly status: SupportTicketStatus;
}

/**
 * Aggregated counts of a client's support tickets grouped by status.
 * `total` equals the sum of `open`, `resolved` and `closed`.
 * Pure and deterministic.
 */
export interface ClientHistorySummary {
  readonly total: number;
  readonly open: number;
  readonly resolved: number;
  readonly closed: number;
}

/**
 * Summarizes a client's support history by counting tickets per status.
 * Tickets with an unrecognized status are counted only in `total`.
 * Empty or undefined input yields all-zero counts.
 * Pure and deterministic.
 */
export const summarizeClientHistory = (
  tickets: readonly ClientHistoryTicket[] | undefined,
): ClientHistorySummary => {
  if (!tickets || tickets.length === 0) {
    return { total: 0, open: 0, resolved: 0, closed: 0 };
  }
  let open = 0;
  let resolved = 0;
  let closed = 0;
  for (const ticket of tickets) {
    switch (ticket.status) {
      case "abierto":
        open += 1;
        break;
      case "resuelto":
        resolved += 1;
        break;
      case "cerrado":
        closed += 1;
        break;
      default:
        break;
    }
  }
  return { total: tickets.length, open, resolved, closed };
};
