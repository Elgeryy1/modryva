// European Roulette — single-zero wheel (pockets 0..36).
//
// This module is PURE + DETERMINISTIC: the winning pocket is derived entirely
// from (serverSeed, clientSeed, nonce) via the provably-fair fairInt helper, so
// anyone can recompute and verify any spin. No I/O, clock, network, or Math.random.
//
// HOUSE EDGE: the wheel has 37 pockets (0..36) but every bet is priced as if
// there were only 36 (no zero). A straight-up bet pays 36x on a 1/37 chance;
// expected return = 36 * (1/37) = 36/37 ≈ 0.97297, i.e. a house edge of
// exactly 1/37 ≈ 2.70% — the standard single-zero European edge. The same 1/37
// edge applies to every outside bet, because the single green zero (pocket 0)
// loses ALL outside bets (red/black/odd/even/low/high/dozen/column).
//
// Multipliers below INCLUDE the stake back on a win (so they are × stake, with
// 0 meaning a total loss). A straight hit returns 36× (35:1 winnings + stake).

import { fairInt } from "./fairness.js";

/**
 * The RED numbers on a European wheel. Every other non-zero pocket is black;
 * pocket 0 is green (neither red nor black).
 */
export const RED_NUMBERS: ReadonlySet<number> = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

/** A single bet placed on the wheel. */
export type RouletteBet =
  | { kind: "straight"; n: number }
  | { kind: "red" | "black" | "odd" | "even" | "low" | "high" }
  | { kind: "dozen" | "column"; index: 1 | 2 | 3 };

/**
 * Spin the wheel: returns the winning pocket in [0, 36] inclusive, drawn
 * uniformly and verifiably from (serverSeed, clientSeed, nonce).
 */
export const spinRoulette = (
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): number => fairInt(serverSeed, clientSeed, nonce, 0, 36);

/** True if the pocket is red. Pocket 0 (green) is never red. */
const isRed = (pocket: number): boolean => RED_NUMBERS.has(pocket);

/**
 * European payout multiplier for a bet given the winning pocket, INCLUDING the
 * stake back on a win (0 = loss). Pocket 0 wins only a straight bet on 0 and
 * loses every outside bet.
 *   - straight: 36 on exact match, else 0
 *   - red/black/odd/even/low/high: 2 on match (never for 0), else 0
 *   - dozen/column: 3 on match (never for 0), else 0
 */
export const rouletteMultiplier = (
  bet: RouletteBet,
  pocket: number,
): number => {
  // Pocket 0 loses all bets except a straight-up bet on 0 itself.
  if (pocket === 0) {
    return bet.kind === "straight" && bet.n === 0 ? 36 : 0;
  }

  switch (bet.kind) {
    case "straight":
      return bet.n === pocket ? 36 : 0;
    case "red":
      return isRed(pocket) ? 2 : 0;
    case "black":
      return isRed(pocket) ? 0 : 2;
    case "odd":
      return pocket % 2 === 1 ? 2 : 0;
    case "even":
      return pocket % 2 === 0 ? 2 : 0;
    case "low":
      // 1..18
      return pocket <= 18 ? 2 : 0;
    case "high":
      // 19..36
      return pocket >= 19 ? 2 : 0;
    case "dozen": {
      // dozen 1 = 1..12, 2 = 13..24, 3 = 25..36
      const dozen = Math.ceil(pocket / 12);
      return dozen === bet.index ? 3 : 0;
    }
    case "column": {
      // column index = ((pocket - 1) mod 3) + 1, i.e. 1,4,7,.. -> col 1
      const column = ((pocket - 1) % 3) + 1;
      return column === bet.index ? 3 : 0;
    }
    default: {
      // Exhaustiveness guard — unreachable under the RouletteBet union.
      const _never: never = bet;
      return _never;
    }
  }
};

/** Human-readable color/label for a pocket. */
const pocketColor = (pocket: number): string =>
  pocket === 0 ? "green" : isRed(pocket) ? "red" : "black";

/**
 * One-line English render of a spin outcome. `mult` is the value returned by
 * rouletteMultiplier for this (bet, pocket) pair.
 */
export const describeRoulette = (
  pocket: number,
  bet: RouletteBet,
  mult: number,
): string => {
  const where =
    bet.kind === "straight"
      ? `straight ${bet.n}`
      : bet.kind === "dozen" || bet.kind === "column"
        ? `${bet.kind} ${bet.index}`
        : bet.kind;
  const board = `🎡 Ball landed on ${pocket} (${pocketColor(pocket)}) — bet ${where}`;
  return mult > 0 ? `${board} — WIN, pays ${mult}× 🏆` : `${board} — no win 💸`;
};
