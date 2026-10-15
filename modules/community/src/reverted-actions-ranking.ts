/**
 * A single moderation action outcome. `type` is a stable action kind
 * (e.g. "ban", "mute", "warn") and `reverted` marks whether it was undone.
 */
export interface RevertedAction {
  readonly type: string;
  readonly reverted: boolean;
}

/**
 * Aggregated reversion stats for one action type. `reverted` is the count of
 * undone actions, `total` the count of all actions of that type, and `rate`
 * the reverted/total ratio rounded to 2 decimals (0 when total is 0).
 */
export interface RevertedActionRank {
  readonly type: string;
  readonly reverted: number;
  readonly total: number;
  readonly rate: number;
}

/**
 * Rounds a ratio to 2 decimals using half-up rounding on the hundredths.
 * Pure and deterministic.
 */
const roundRate = (reverted: number, total: number): number => {
  if (total === 0) {
    return 0;
  }
  return Math.round((reverted / total) * 100) / 100;
};

/**
 * Builds a ranking of the most-reverted action types. Tallies reverted and
 * total counts per `type`, computes rate = reverted/total rounded to 2
 * decimals, and returns one entry per distinct type sorted by `reverted`
 * descending, breaking ties by `type` ascending. Empty input yields an empty
 * ranking. Pure and deterministic.
 */
export const rankRevertedActions = (
  actions: readonly RevertedAction[],
): readonly RevertedActionRank[] => {
  const tallies = new Map<string, { reverted: number; total: number }>();

  for (const action of actions) {
    const current = tallies.get(action.type) ?? { reverted: 0, total: 0 };
    tallies.set(action.type, {
      reverted: current.reverted + (action.reverted ? 1 : 0),
      total: current.total + 1,
    });
  }

  const ranked: RevertedActionRank[] = [];
  for (const [type, tally] of tallies) {
    ranked.push({
      type,
      reverted: tally.reverted,
      total: tally.total,
      rate: roundRate(tally.reverted, tally.total),
    });
  }

  ranked.sort((a, b) => {
    if (b.reverted !== a.reverted) {
      return b.reverted - a.reverted;
    }
    if (a.type < b.type) {
      return -1;
    }
    if (a.type > b.type) {
      return 1;
    }
    return 0;
  });

  return ranked;
};
