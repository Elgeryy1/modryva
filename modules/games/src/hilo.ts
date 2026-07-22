// Hi-Lo — single-shot "higher or lower" card draw (rank only, 1..13, no suits).
//
// This module is PURE + DETERMINISTIC: both cards are derived entirely from
// (serverSeed, clientSeed, nonce) via the provably-fair fairFloat helper (one
// distinct stream cursor per card), so anyone can recompute and verify the
// draw. No I/O, clock, network, or
// Math.random. Unlike Crash/Mines this is NOT a multi-step session — the
// current card and the next card are both drawn and revealed atomically in
// the same call that resolves the bet.
//
// HOUSE EDGE: a tie (next === current) always loses, for BOTH "higher" and
// "lower" bets — exactly like the green pocket 0 in roulette. This shaves the
// tie outcome off of both sides' win chance, which is what funds the edge
// baked into diceMultiplier-style pricing below.

import { CASINO } from "./casino.js";
import { fairFloat } from "./fairness.js";

/** Uniform integer in [1, 13] from a specific cursor of the HMAC stream. */
const fairRank = (
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  cursor: number,
): number =>
  1 + Math.floor(fairFloat(serverSeed, clientSeed, nonce, cursor) * 13);

/** A bet on whether the next card's rank is higher or lower than the current one. */
export type HiLoBet = { kind: "higher" | "lower" };

export interface HiLoDeal {
  /** Current (first) card rank, 1 (ace) .. 13 (king). No suits. */
  readonly current: number;
  /** Next (second) card rank, drawn in the same round. */
  readonly next: number;
}

/**
 * Deal both cards for one round: `current` first, `next` second, drawn from
 * distinct cursors of the same (serverSeed, clientSeed, nonce) stream so the
 * whole round is reproducible from a single revealed seed.
 */
export const dealHiLo = (
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): HiLoDeal => {
  const current = fairRank(serverSeed, clientSeed, nonce, 0);
  const next = fairRank(serverSeed, clientSeed, nonce, 1);
  return { current, next };
};

/**
 * Payout multiplier (× stake) for a Hi-Lo bet, given the already-known deal.
 * Priced like dice: multiplier = floor((1 / winChance) × (1 − houseEdge)),
 * where winChance is computed for THIS SPECIFIC current card (not a fixed
 * table), because how many ranks are strictly above/below depends on it.
 * A tie (next === current) always loses. Returns 0 when the bet is
 * impossible for this current card (e.g. "higher" when current = 13) to
 * avoid dividing by zero.
 */
export const hiLoMultiplier = (bet: HiLoBet, deal: HiLoDeal): number => {
  const { current, next } = deal;
  const win = bet.kind === "higher" ? next > current : next < current;
  if (!win) {
    return 0;
  }
  const favorableCount = bet.kind === "higher" ? 13 - current : current - 1;
  if (favorableCount <= 0) {
    return 0;
  }
  const winChance = favorableCount / 13;
  return Math.floor((1 / winChance) * (1 - CASINO.houseEdge));
};

const RANK_LABEL: Record<number, string> = {
  1: "A",
  11: "J",
  12: "Q",
  13: "K",
};

/** Human-readable rank, e.g. "A", "7", "K". */
const rankLabel = (rank: number): string => RANK_LABEL[rank] ?? String(rank);

/** One-line Spanish render of a Hi-Lo round outcome. */
export const describeHiLo = (
  deal: HiLoDeal,
  bet: HiLoBet,
  mult: number,
): string => {
  const pick = bet.kind === "higher" ? "alto" : "bajo";
  const board = `🃏 ${rankLabel(deal.current)} → ${rankLabel(deal.next)} — apuesta ${pick}`;
  return mult > 0
    ? `${board} — GANA, paga ${mult}× 🏆`
    : `${board} — no gana 💸`;
};
