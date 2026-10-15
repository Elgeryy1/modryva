/**
 * Retention counts for players and non-players of the group's games.
 * Pure and deterministic.
 */
export interface GamesRetentionInput {
  readonly playersRetained: number;
  readonly playersTotal: number;
  readonly nonPlayersRetained: number;
  readonly nonPlayersTotal: number;
}

/**
 * Retention rates for each cohort and whether games are associated with better
 * retention. Pure and deterministic.
 */
export interface GamesRetentionResult {
  readonly playerRate: number;
  readonly nonPlayerRate: number;
  readonly positive: boolean;
}

const roundRate = (retained: number, total: number): number =>
  total === 0 ? 0 : Math.round((retained / total) * 100) / 100;

/**
 * Measures the impact of games on retention by comparing the retention rate of
 * players against non-players (rounded to 2 decimals). "positive" is true when
 * players retain better than non-players. Pure and deterministic.
 */
export const computeGamesRetention = (
  input: GamesRetentionInput,
): GamesRetentionResult => {
  const playerRate = roundRate(input.playersRetained, input.playersTotal);
  const nonPlayerRate = roundRate(
    input.nonPlayersRetained,
    input.nonPlayersTotal,
  );
  return { playerRate, nonPlayerRate, positive: playerRate > nonPlayerRate };
};
