import { fairShuffle } from "./fairness.js";

/**
 * MINES — minesweeper-with-bet on a 5x5 grid (25 tiles, indices 0..24).
 *
 * Provably fair: the entire mine layout derives from a single `fairShuffle` of
 * the 25 tile indices, seeded by (serverSeed, clientSeed, nonce). Anyone can
 * recompute the shuffle and confirm the mines. Nothing here reads I/O, the
 * clock, or randomness — every outcome is a pure function of its inputs.
 *
 * HOUSE EDGE (positive, documented):
 *   The fair multiplier after `revealed` safe picks is the inverse of the
 *   probability of surviving those picks:
 *
 *     fair = product over i in [0, revealed) of (25 - i) / (25 - mineCount - i)
 *
 *   which equals 1 / P(survive) and therefore has an expected value of exactly
 *   1x (zero edge) under fair play. We multiply by (1 - houseEdge), default
 *   0.03 = 3%, so the operator keeps a positive 3% margin: expected payout is
 *   0.97x stake. The edge is applied once to the final multiplier, then the
 *   result is truncated to 2 decimals (rounded down) so rounding never hands
 *   the player more than the intended edge allows.
 */

export const MINES_TILES = 25;
export const DEFAULT_HOUSE_EDGE = 0.03;

/**
 * The sorted mine tile indices (0..24) for a round. We shuffle all 25 tile
 * indices with the fair permutation, take the first `mineCount`, and sort them
 * for a stable, verifiable layout.
 *
 * `mineCount` is clamped to [1, 24] — at least one mine, and at least one safe
 * tile must remain so the game is playable.
 */
export function minesLayout(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  mineCount: number,
): number[] {
  const mines = clampMineCount(mineCount);
  const shuffled = fairShuffle(serverSeed, clientSeed, nonce, MINES_TILES);
  const picked: number[] = [];
  for (let i = 0; i < mines; i += 1) {
    const tile = shuffled[i];
    if (tile !== undefined) {
      picked.push(tile);
    }
  }
  return picked.sort((a, b) => a - b);
}

/**
 * Fair multiplier after `revealed` safe picks against `mineCount` mines, scaled
 * by (1 - houseEdge) and truncated to 2 decimals. With `revealed === 0` the
 * multiplier is (1 - houseEdge) — cashing out before any pick returns stake
 * minus the edge. Rises with both `revealed` and `mineCount`.
 */
export function minesMultiplier(
  mineCount: number,
  revealed: number,
  houseEdge: number = DEFAULT_HOUSE_EDGE,
): number {
  const mines = clampMineCount(mineCount);
  const safeTiles = MINES_TILES - mines;
  const picks = clampRevealed(revealed, safeTiles);

  let fair = 1;
  for (let i = 0; i < picks; i += 1) {
    const remaining = MINES_TILES - i;
    const safeRemaining = safeTiles - i;
    // safeRemaining is >= 1 here because picks <= safeTiles.
    fair *= remaining / safeRemaining;
  }

  const edge = clampHouseEdge(houseEdge);
  const scaled = fair * (1 - edge);
  return floor2(scaled);
}

/** Whether `tile` is one of the mine tiles in `layout`. */
export function isMine(layout: number[], tile: number): boolean {
  return layout.includes(tile);
}

/** Human-readable, JSON-safe status string for a round's current state. */
export function describeMines(
  mineCount: number,
  revealed: number,
  cashedOut: boolean,
  hitMine: boolean,
): string {
  const mines = clampMineCount(mineCount);
  const safeTiles = MINES_TILES - mines;
  const picks = clampRevealed(revealed, safeTiles);
  const multiplier = minesMultiplier(mines, picks);

  if (hitMine) {
    return `Boom! Hit a mine after ${picks} safe pick${plural(picks)} with ${mines} mine${plural(
      mines,
    )} — round lost (0x).`;
  }
  if (cashedOut) {
    return `Cashed out at ${multiplier.toFixed(2)}x after ${picks} safe pick${plural(
      picks,
    )} with ${mines} mine${plural(mines)}.`;
  }
  if (picks >= safeTiles) {
    return `Cleared the board! All ${safeTiles} safe tile${plural(
      safeTiles,
    )} revealed at ${multiplier.toFixed(2)}x with ${mines} mine${plural(mines)}.`;
  }
  return `In play: ${picks} safe pick${plural(picks)} of ${safeTiles}, ${mines} mine${plural(
    mines,
  )} hidden, current cashout ${multiplier.toFixed(2)}x.`;
}

function clampMineCount(mineCount: number): number {
  const n = Math.floor(mineCount);
  if (Number.isNaN(n) || n < 1) {
    return 1;
  }
  if (n > MINES_TILES - 1) {
    return MINES_TILES - 1;
  }
  return n;
}

function clampRevealed(revealed: number, safeTiles: number): number {
  const r = Math.floor(revealed);
  if (Number.isNaN(r) || r < 0) {
    return 0;
  }
  if (r > safeTiles) {
    return safeTiles;
  }
  return r;
}

function clampHouseEdge(houseEdge: number): number {
  if (Number.isNaN(houseEdge) || houseEdge < 0) {
    return 0;
  }
  if (houseEdge >= 1) {
    return 1;
  }
  return houseEdge;
}

/** Truncate (round down) to 2 decimals so rounding never favors the player. */
function floor2(value: number): number {
  return Math.floor(value * 100) / 100;
}

function plural(n: number): string {
  return n === 1 ? "" : "s";
}
