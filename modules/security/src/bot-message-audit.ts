/**
 * One audited outbound bot message, reduced to the single dimension we tally:
 * its kind (for example "text", "photo", "sticker", "poll").
 * Pure and deterministic.
 */
export interface BotMessageAuditEntry {
  readonly kind: string;
}

/**
 * A single kind grouped with how many audited messages had that kind.
 * Pure and deterministic.
 */
export interface BotMessageKindTally {
  readonly kind: string;
  readonly count: number;
}

/**
 * Audit summary of messages the bot sent: the total count plus a per-kind
 * breakdown sorted by count descending, then by kind ascending for ties.
 * Pure and deterministic.
 */
export interface BotMessageAuditSummary {
  readonly total: number;
  readonly byKind: readonly BotMessageKindTally[];
}

/**
 * Compares two kind strings for a stable ascending (code-point) order.
 * Internal helper, kept unexported to avoid barrel symbol clashes.
 * Pure and deterministic.
 */
const compareKindAsc = (a: string, b: string): number => {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
};

/**
 * Tallies audited bot messages by kind. Returns the total number of messages
 * and a per-kind breakdown sorted by count descending, breaking ties by kind
 * ascending. An empty input yields a total of 0 and an empty breakdown.
 * Pure and deterministic.
 */
export const summarizeBotMessages = (
  messages: readonly BotMessageAuditEntry[],
): BotMessageAuditSummary => {
  const counts = new Map<string, number>();
  for (const message of messages) {
    const current = counts.get(message.kind) ?? 0;
    counts.set(message.kind, current + 1);
  }

  const byKind: BotMessageKindTally[] = [];
  for (const [kind, count] of counts) {
    byKind.push({ kind, count });
  }

  byKind.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return compareKindAsc(a.kind, b.kind);
  });

  return { total: messages.length, byKind };
};
