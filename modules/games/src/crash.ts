// Crash / 🚀 — provably-fair "rocket" round.
//
// This module is PURE and DETERMINISTIC: the crash multiplier for a round is
// fixed at round start from (serverSeed, clientSeed, nonce) via the fairness
// core. No I/O, DB, clock, randomness or network here — anyone can recompute
// the exact crash point from the revealed seeds and verify the round was fixed
// in advance, independent of the bet.
//
// ── Distribution & house edge ──────────────────────────────────────────────
// We draw a uniform f ∈ [0, 1) with fairFloat and map it to a crash multiplier
// so that, IGNORING rounding/caps, P(crash ≥ x) = 0.99 / x for x ≥ 1. That
// 0.99 factor is the 1% HOUSE EDGE and it is POSITIVE by construction:
//
//   • A fair (edgeless) game would use 1.00 / x, giving each player an expected
//     return of exactly 1× their stake.
//   • Using 0.99 / x means ~1% of rounds "instant-crash" below 1.00 and are
//     floored to 1.00, so the expected payout of the natural "cash out at the
//     crash point" strategy is 0.99× the stake — a +1% edge for the house.
//   • Concretely: crash = 0.99 / f. With f uniform on [0,1), the raw multiplier
//     is ≥ x with probability P(0.99/f ≥ x) = P(f ≤ 0.99/x) = 0.99/x for x ≥ 0.99.
//
// The result is floored to 2 decimals, clamped to a minimum of 1.00 (an
// instant crash) and capped at MAX_CRASH so payouts stay bounded and JSON-safe.

import { fairFloat } from "./fairness.js";

/** Largest multiplier a round can reach (bounds payout + JSON size). */
export const MAX_CRASH = 1000;

/** The house-edge numerator: 0.99 ⇒ 1% edge. Fair would be 1.00. */
export const CRASH_EDGE_FACTOR = 0.99;

export interface CrashSettlement {
  readonly win: boolean;
  /** The multiplier actually applied to the stake (cashoutAt on a win, else 0). */
  readonly multiplier: number;
  /** floor(stake * cashoutAt) on a win, else 0. */
  readonly payout: number;
}

/**
 * The crash multiplier (≥ 1.00, 2 decimals) fixed at round start from the seed.
 *
 * f = fairFloat(serverSeed, clientSeed, nonce). If f === 0 (degenerate, the raw
 * multiplier would be infinite) we return the cap. Otherwise:
 *   crash = clamp( floor((0.99 / f) * 100) / 100 , 1.00 .. MAX_CRASH )
 */
export const crashPoint = (
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): number => {
  const f = fairFloat(serverSeed, clientSeed, nonce);
  if (f === 0) {
    return MAX_CRASH;
  }
  const raw = Math.floor((CRASH_EDGE_FACTOR / f) * 100) / 100;
  return Math.min(MAX_CRASH, Math.max(1, raw));
};

/**
 * Settle a bet against a fixed crash point.
 *   • win  ⇔ cashoutAt > 1.00 AND cashoutAt ≤ crash (the player bailed before
 *     the rocket blew up). crash is floored to a minimum of 1.00 for the ~1%
 *     of rounds that instant-crash, so cashoutAt === 1.00 must NEVER win —
 *     otherwise it would be a risk-free refund on every round, erasing the
 *     house edge entirely.
 *   • payout = floor(stake * cashoutAt) on a win, else 0
 * A win pays at the player's chosen cashout, NOT the crash point.
 */
export const settleCrash = (
  crash: number,
  cashoutAt: number,
  stake: number,
): CrashSettlement => {
  const win = cashoutAt > 1 && cashoutAt <= crash;
  if (!win) {
    return { win: false, multiplier: 0, payout: 0 };
  }
  return {
    win: true,
    multiplier: cashoutAt,
    payout: Math.floor(stake * cashoutAt),
  };
};

/** One-line Spanish render with the 🚀 rocket for a settled crash round. */
export const describeCrash = (
  crash: number,
  cashoutAt: number,
  win: boolean,
): string => {
  const board = `🚀 Crash x${crash.toFixed(2)} · retiro x${cashoutAt.toFixed(2)}`;
  return win
    ? `${board} — ¡Retirado a tiempo! 🤑`
    : `${board} — ¡Explotó! 💥 Apuesta perdida.`;
};
