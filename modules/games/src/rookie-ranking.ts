/**
 * A single player entry accepted by separateRookieRanking. Combines an id,
 * a numeric score and how many days old the account is.
 * Pure and deterministic.
 */
export interface RookieRankingPlayer {
  readonly id: string;
  readonly score: number;
  readonly ageDays: number;
}

/**
 * A ranked player as returned in the rookie or veteran lists. Only exposes
 * the id and score, already sorted.
 * Pure and deterministic.
 */
export interface RookieRankedPlayer {
  readonly id: string;
  readonly score: number;
}

/**
 * Optional tuning for separateRookieRanking. rookieMaxDays is the inclusive
 * upper bound (in days) for a player to be considered a rookie. Defaults to 7.
 * Pure and deterministic.
 */
export interface RookieRankingOptions {
  readonly rookieMaxDays?: number;
}

/**
 * Result of separateRookieRanking: two independent leaderboards, one for
 * rookies and one for veterans, each already sorted.
 * Pure and deterministic.
 */
export interface RookieRankingResult {
  readonly rookies: readonly RookieRankedPlayer[];
  readonly veterans: readonly RookieRankedPlayer[];
}

const DEFAULT_ROOKIE_MAX_DAYS = 7;

/**
 * Sorts ranked players by score descending, breaking ties by id ascending.
 * Internal helper, not exported to avoid barrel symbol clashes.
 */
const sortRankedPlayers = (
  players: readonly RookieRankedPlayer[],
): readonly RookieRankedPlayer[] =>
  [...players].sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

/**
 * Splits players into a rookie leaderboard and a veteran leaderboard based on
 * account age. A player is a rookie when ageDays is less than or equal to
 * rookieMaxDays (default 7); otherwise a veteran. Each list is projected to
 * { id, score } and sorted by score descending, ties broken by id ascending.
 * Pure and deterministic.
 */
export const separateRookieRanking = (
  players: readonly RookieRankingPlayer[],
  options?: RookieRankingOptions,
): RookieRankingResult => {
  const maxDays = options?.rookieMaxDays ?? DEFAULT_ROOKIE_MAX_DAYS;
  const rookies: RookieRankedPlayer[] = [];
  const veterans: RookieRankedPlayer[] = [];
  for (const player of players) {
    const ranked: RookieRankedPlayer = { id: player.id, score: player.score };
    if (player.ageDays <= maxDays) {
      rookies.push(ranked);
    } else {
      veterans.push(ranked);
    }
  }
  return {
    rookies: sortRankedPlayers(rookies),
    veterans: sortRankedPlayers(veterans),
  };
};
