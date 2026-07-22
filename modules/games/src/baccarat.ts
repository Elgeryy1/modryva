// Baccarat SIMPLIFICADO — una carta cada lado (Banca vs Jugador), sin la regla
// de tercera carta del baccarat real de casino. Cada carta se representa
// directamente por su valor baccarat: 0-9 (as=1..9=9, 10/J/Q/K=0).
//
// This module is PURE + DETERMINISTIC: both values are derived entirely from
// (serverSeed, clientSeed, nonce) via the provably-fair fairInt helper, using
// distinct cursors so the two draws are independent, verifiable numbers.
//
// PROBABILITY MATH (exact, over the 10×10 = 100 equally-likely combinations of
// bancaValue, jugadorValue ∈ [0,9]):
//   - jugador gana (jugadorValue > bancaValue): for each bancaValue b in 0..9,
//     there are (9 - b) jugador values that beat it → sum_{b=0}^{9}(9-b) = 45.
//   - banca gana (bancaValue > jugadorValue): by symmetry, also 45.
//   - empate (bancaValue === jugadorValue): exactly 10 combos (b === j).
//   45 + 45 + 10 = 100. ✓
// So P(player) = P(banker) = 0.45, P(tie) = 0.10.
//
// Multipliers (× stake, INCLUDING the stake back on a win; 0 = total loss)
// are derived from CASINO.houseEdge (2%) via the standard formula used across
// this casino: multiplier = (1 / winChance) × (1 - houseEdge).
//   - player/banker: (1 / 0.45) × 0.98 ≈ 2.1778
//   - tie:           (1 / 0.10) × 0.98 = 9.8

import { CASINO } from "./casino.js";
import { fairFloat } from "./fairness.js";

/** A single bet placed on a Baccarat round. */
export type BaccaratBet = { kind: "player" | "banker" | "tie" };

/** The two dealt values, each in [0, 9]. */
export interface BaccaratDeal {
  readonly bancaValue: number;
  readonly jugadorValue: number;
}

/** Exact win probabilities over the 100 (banca, jugador) combinations. */
const PLAYER_CHANCE = 0.45;
const BANKER_CHANCE = 0.45;
const TIE_CHANCE = 0.1;

/**
 * Uniform integer in [0, 9] from the fair float stream at the given cursor —
 * same mapping fairInt uses internally, but fairInt has no cursor parameter,
 * so we call fairFloat directly to get two INDEPENDENT draws (banca vs
 * jugador) from the same (serverSeed, clientSeed, nonce).
 */
const fairDigit = (
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  cursor: number,
): number => Math.floor(fairFloat(serverSeed, clientSeed, nonce, cursor) * 10);

/**
 * Deal one round: a card value for Banca (cursor 0) and one for Jugador
 * (cursor 1), each uniformly in [0, 9] and independently verifiable.
 */
export const dealBaccarat = (
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): BaccaratDeal => ({
  bancaValue: fairDigit(serverSeed, clientSeed, nonce, 0),
  jugadorValue: fairDigit(serverSeed, clientSeed, nonce, 1),
});

/**
 * Payout multiplier (× stake) for a bet given the dealt values, derived from
 * the exact win chance with a fixed house edge: multiplier = (1 / chance) ×
 * (1 - edge). Returns 0 on a loss.
 */
export const baccaratMultiplier = (
  bet: BaccaratBet,
  deal: BaccaratDeal,
  edge = CASINO.houseEdge,
): number => {
  const { bancaValue, jugadorValue } = deal;
  switch (bet.kind) {
    case "player":
      return jugadorValue > bancaValue
        ? Math.round((1 / PLAYER_CHANCE) * (1 - edge) * 100) / 100
        : 0;
    case "banker":
      return bancaValue > jugadorValue
        ? Math.round((1 / BANKER_CHANCE) * (1 - edge) * 100) / 100
        : 0;
    case "tie":
      return bancaValue === jugadorValue
        ? Math.round((1 / TIE_CHANCE) * (1 - edge) * 100) / 100
        : 0;
    default: {
      // Exhaustiveness guard — unreachable under the BaccaratBet union.
      const _never: never = bet.kind;
      return _never;
    }
  }
};

/** One-line Spanish render of a dealt round + bet outcome. */
export const describeBaccarat = (
  deal: BaccaratDeal,
  bet: BaccaratBet,
  mult: number,
): string => {
  const board = `🃏 Banca ${deal.bancaValue} vs Jugador ${deal.jugadorValue} — apuesta ${bet.kind}`;
  return mult > 0
    ? `${board} — GANA, paga ${mult}× 🏆`
    : `${board} — no gana 💸`;
};
