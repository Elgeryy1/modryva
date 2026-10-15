// Dice Duel — PvP resolver for two Telegram 🎲 rolls.
//
// This module is PURE: outcomes come in as the Telegram dice VALUE for each
// player (🎲 returns dice.value in 1..6, treated here as ~uniform 1-6). There is
// no randomness, I/O, clock, or network here — Telegram generates the rolls and
// we only COMPARE + PRICE them, so the resolution is deterministic and testable.
//
// House economics: the game itself is player-vs-player and symmetric (each
// non-tie side wins 50% of the time), so there is no per-roll house edge. The
// house earns via a RAKE skimmed off the pot when paying the winner
// (duelPayout). Ties (winner 0) are the caller's cue to refund both stakes.

/** Winner code: 1 = player A higher, 2 = player B higher, 0 = tie. */
export type DuelWinner = 0 | 1 | 2;

export interface DuelDetail {
  readonly rollA: number;
  readonly rollB: number;
  readonly winner: DuelWinner;
}

export interface DuelResult {
  readonly winner: DuelWinner;
  readonly detail: DuelDetail;
}

/** Default house rake taken off the pot when paying the winner (5%). */
export const DEFAULT_DUEL_RAKE = 0.05;

/** Valid Telegram 🎲 value range (~uniform 1-6). */
const isDiceValue = (value: number): boolean =>
  Number.isInteger(value) && value >= 1 && value <= 6;

/**
 * Compare two 🎲 rolls. Higher wins; equal rolls tie.
 * @throws if either roll is not an integer in 1..6.
 */
export const resolveDuel = (rollA: number, rollB: number): DuelResult => {
  if (!isDiceValue(rollA) || !isDiceValue(rollB)) {
    throw new RangeError(
      `Dice values must be integers in 1..6 (got ${rollA}, ${rollB})`,
    );
  }
  const winner: DuelWinner = rollA > rollB ? 1 : rollB > rollA ? 2 : 0;
  return { winner, detail: { rollA, rollB, winner } };
};

/**
 * The winner's payout from a pot after the house rake:
 *   floor(pot * (1 - (rake ?? 0.05)))
 * `pot` is the combined stakes (an integer). Rake defaults to DEFAULT_DUEL_RAKE.
 * @throws if pot is not a non-negative integer, or rake is outside [0, 1).
 */
export const duelPayout = (pot: number, rake?: number): number => {
  const r = rake ?? DEFAULT_DUEL_RAKE;
  if (!Number.isInteger(pot) || pot < 0) {
    throw new RangeError(`Pot must be a non-negative integer (got ${pot})`);
  }
  if (!(r >= 0 && r < 1)) {
    throw new RangeError(`Rake must be in [0, 1) (got ${r})`);
  }
  return Math.floor(pot * (1 - r));
};

/** One-line Spanish render with 🎲 emoji for the duel outcome. */
export const describeDuel = (
  nameA: string,
  rollA: number,
  nameB: string,
  rollB: number,
  winner: DuelWinner,
): string => {
  const board = `🎲 ${nameA} sacó ${rollA} · ${nameB} sacó ${rollB}`;
  if (winner === 1) {
    return `${board} — ¡Gana ${nameA}! 🏆`;
  }
  if (winner === 2) {
    return `${board} — ¡Gana ${nameB}! 🏆`;
  }
  return `${board} — ¡Empate! 🤝 Se devuelven las apuestas.`;
};
