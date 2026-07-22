/**
 * One event that happened during an admin shift, identified by its kind.
 * The `kind` is a free-form label such as "ban", "warn" or "mute".
 * Pure and deterministic.
 */
export interface ShiftSummaryEvent {
  readonly kind: string;
}

/**
 * A single kind tally: how many times `kind` occurred during the shift.
 * Pure and deterministic.
 */
export interface ShiftKindTally {
  readonly kind: string;
  readonly count: number;
}

/**
 * The end-of-shift summary handed to each admin: total events, a per-kind
 * breakdown and a ready-to-send user-facing Spanish line.
 * Pure and deterministic.
 */
export interface ShiftSummaryResult {
  readonly total: number;
  readonly byKind: readonly ShiftKindTally[];
  readonly text: string;
}

/**
 * Formats the per-kind breakdown into a single Spanish fragment, e.g.
 * "ban x3, warn x2". Uses the multiplication sign for compactness.
 */
const formatBreakdown = (byKind: readonly ShiftKindTally[]): string =>
  byKind.map((entry) => `${entry.kind} ×${entry.count}`).join(", ");

/**
 * Builds an end-of-shift summary from the events collected during the shift.
 * Tallies events by `kind`, sorts the breakdown by count descending and then
 * by kind ascending (alphabetical) to break ties, and produces a user-facing
 * Spanish one-liner with correct accents. An empty input yields a friendly
 * "no activity" line. Pure and deterministic.
 */
export const buildShiftSummary = (
  events: readonly ShiftSummaryEvent[],
): ShiftSummaryResult => {
  const counts = new Map<string, number>();
  for (const event of events) {
    const previous = counts.get(event.kind) ?? 0;
    counts.set(event.kind, previous + 1);
  }

  const byKind: ShiftKindTally[] = [];
  for (const [kind, count] of counts) {
    byKind.push({ kind, count });
  }
  byKind.sort((a, b) => {
    if (a.count !== b.count) {
      return b.count - a.count;
    }
    if (a.kind < b.kind) {
      return -1;
    }
    if (a.kind > b.kind) {
      return 1;
    }
    return 0;
  });

  const total = events.length;
  if (total === 0) {
    return {
      total: 0,
      byKind: [],
      text: "Resumen de guardia: sin actividad en el turno. 😴",
    };
  }

  const noun = total === 1 ? "evento" : "eventos";
  const breakdown = formatBreakdown(byKind);
  const text = `Resumen de guardia: ${total} ${noun} en el turno (${breakdown}). 📋`;

  return { total, byKind, text };
};
