// Sic Bo — 3 dice (1..6 each), provably-fair.
//
// This module is PURE + DETERMINISTIC: every die is derived entirely from
// (serverSeed, clientSeed, nonce, cursor) via fairFloat, so anyone can
// recompute and verify any roll. No I/O, clock, network, or Math.random.
// (fairInt itself takes no cursor, so each die reads its own HMAC cursor
// directly via fairFloat, the same way plinko.ts draws one fairFloat per row.)
//
// HOUSE EDGE (documented, like the green 0 in roulette.ts):
// Sums over the 6×6×6 = 216 equally-likely combinations distribute as
// 3:1 4:3 5:6 6:10 7:15 8:21 9:25 10:27 11:27 12:25 13:21 14:15 15:10 16:6 17:3 18:1
// (verified by exhaustive enumeration, not assumed).
//   - small = sum 4..10: 3+6+10+15+21+25+27 = 107 combinations.
//   - big   = sum 11..17: 27+25+21+15+10+6+3 = 107 combinations (symmetric).
// A TRIPLE ANY (all 3 dice equal) is the analogue of roulette's green zero: it
// always loses small/big, even though its sum may fall in [4,10] or [11,17].
// The only triples inside those ranges are 2-2-2 (sum 6) and 3-3-3 (sum 9) for
// small, and 4-4-4 (sum 12) and 5-5-5 (sum 15) for big — 2 combinations each.
// So the PAYING combinations are 107 - 2 = 105 out of 216 for both small and
// big: probability 105/216 ≈ 48.611%.
// A specific triple (e.g. all three dice show 5) has exactly 1/216 probability
// (only the single combo 5-5-5 hits it) — the rarest, highest-paying bet.
//
// Multipliers below INCLUDE the stake back on a win (× stake, 0 = total loss),
// derived from the exact probability with the same house-edge formula used
// everywhere else in the casino: multiplier = floor((1/p) × (1 - houseEdge)).

import { CASINO } from "./casino.js";
import { fairFloat } from "./fairness.js";

export type SicBoBet =
  | { kind: "small" }
  | { kind: "big" }
  | { kind: "triple"; value: 1 | 2 | 3 | 4 | 5 | 6 };

export interface SicBoRoll {
  d1: number;
  d2: number;
  d3: number;
}

/** One die in [1, 6] from a uniform float, independent cursor per die. */
const dieFromFloat = (roll: number): number =>
  1 + Math.min(5, Math.floor(roll * 6));

/**
 * Roll the 3 dice: d1/d2/d3 each drawn from their own HMAC cursor (0, 1, 2)
 * so all three are independent given the same (serverSeed, clientSeed, nonce).
 */
export const rollSicBo = (
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): SicBoRoll => ({
  d1: dieFromFloat(fairFloat(serverSeed, clientSeed, nonce, 0)),
  d2: dieFromFloat(fairFloat(serverSeed, clientSeed, nonce, 1)),
  d3: dieFromFloat(fairFloat(serverSeed, clientSeed, nonce, 2)),
});

/** True when all 3 dice show the same value — the "triple any" house zero. */
const isAnyTriple = (roll: SicBoRoll): boolean =>
  roll.d1 === roll.d2 && roll.d2 === roll.d3;

/** Exact win probability (over 216 combinations) for each bet kind. */
const SICBO_PROBABILITY: Record<SicBoBet["kind"], number> = {
  small: 105 / 216,
  big: 105 / 216,
  triple: 1 / 216,
};

/**
 * Payout multiplier (× stake) for a bet, derived from its exact probability:
 * multiplier = floor((1/p) × (1 - houseEdge) × 100) / 100. Same formula as
 * diceMultiplier in casino.ts, applied here with Sic Bo's combinatorial odds.
 */
export const sicBoPayoutMultiplier = (
  kind: SicBoBet["kind"],
  edge: number = CASINO.houseEdge,
): number => {
  const p = SICBO_PROBABILITY[kind];
  return Math.floor((1 / p) * (1 - edge) * 100) / 100;
};

/**
 * Resolve a bet against a roll. Returns 0 on any loss (including the "triple
 * any" house zero that voids small/big), else the payout multiplier × stake.
 */
export const sicBoMultiplier = (bet: SicBoBet, roll: SicBoRoll): number => {
  const sum = roll.d1 + roll.d2 + roll.d3;
  const anyTriple = isAnyTriple(roll);

  switch (bet.kind) {
    case "small":
      // A triple any always loses small/big, regardless of its sum.
      return !anyTriple && sum >= 4 && sum <= 10
        ? sicBoPayoutMultiplier("small")
        : 0;
    case "big":
      return !anyTriple && sum >= 11 && sum <= 17
        ? sicBoPayoutMultiplier("big")
        : 0;
    case "triple":
      return anyTriple && roll.d1 === bet.value
        ? sicBoPayoutMultiplier("triple")
        : 0;
    default: {
      // Exhaustiveness guard — unreachable under the SicBoBet union.
      const _never: never = bet;
      return _never;
    }
  }
};

/** One-line Spanish render of a Sic Bo roll outcome. */
export const describeSicBo = (
  roll: SicBoRoll,
  bet: SicBoBet,
  mult: number,
): string => {
  const sum = roll.d1 + roll.d2 + roll.d3;
  const dice = `🎲${roll.d1} 🎲${roll.d2} 🎲${roll.d3}`;
  const anyTriple = isAnyTriple(roll);
  const where = bet.kind === "triple" ? `triple ${bet.value}` : bet.kind;
  const tag = anyTriple ? ` (triple ${roll.d1})` : "";
  const board = `${dice} = ${sum}${tag} — apuesta ${where}`;
  return mult > 0
    ? `${board} — GANA, paga ${mult}× 🏆`
    : `${board} — no gana 💸`;
};
