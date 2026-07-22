/**
 * A single hidden-reputation award event: a positive gesture from one user
 * that grants secret points. Non-positive point values are ignored by the
 * accumulator so they cannot silently drain a helper's hidden score.
 */
export interface HiddenRepEvent {
  /** Telegram user id that earned the hidden points. */
  readonly userId: number;
  /** Points granted by this event. Values <= 0 are ignored. */
  readonly points: number;
}

/**
 * A revealed hidden-reputation standing: the total secret points a user
 * accumulated over the week, ready to be shown in the weekly reveal.
 */
export interface HiddenRepStanding {
  /** Telegram user id of the helper. */
  readonly userId: number;
  /** Total accumulated positive points for this user. */
  readonly points: number;
}

/**
 * Accumulates secret positive-reputation points per user for the weekly reveal.
 *
 * Sums the points of every event per userId, ignoring any event whose points
 * are not strictly positive (<= 0), and drops users whose total ends up at 0.
 * The result is sorted by points descending, then by userId ascending as a
 * stable tie-breaker, producing a deterministic weekly leaderboard.
 * Pure and deterministic.
 */
export const accumulateHiddenRep = (
  events: readonly HiddenRepEvent[],
): readonly HiddenRepStanding[] => {
  const totals = new Map<number, number>();
  for (const event of events) {
    if (event.points <= 0) {
      continue;
    }
    const current = totals.get(event.userId) ?? 0;
    totals.set(event.userId, current + event.points);
  }
  const standings: HiddenRepStanding[] = [];
  for (const [userId, points] of totals) {
    if (points > 0) {
      standings.push({ userId, points });
    }
  }
  standings.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    return a.userId - b.userId;
  });
  return standings;
};
