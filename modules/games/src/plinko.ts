// Plinko — provably-fair, pure, deterministic.
//
// A ball drops through `rows` pegs. At each row it bounces left ("L") or right
// ("R"); the bounce for row `r` is decided by fairFloat(serverSeed, clientSeed,
// nonce, r) < 0.5 (cursor = row index gives one independent draw per row for the
// SAME nonce). The landing `slot` is the number of right-bounces (0..rows), which
// is exactly how many R's are in the path. The payout multiplier is looked up in a
// symmetric table keyed by risk + rows + slot.
//
// ── HOUSE EDGE (positive, documented) ─────────────────────────────────────────
// The slot distribution is Binomial(rows, 1/2): slot s has probability
// C(rows, s) / 2^rows. Each payout table below was tuned so the expected return
// E[multiplier] = Σ P(slot=s) · payout[s] is < 1, i.e. the house keeps a positive
// margin. Verified expected edges (1 − E[multiplier]):
//
//        rows=8    rows=12   rows=16
//   bajo   4.45%     3.25%     3.53%
//   medio  4.77%     4.25%     4.99%
//   alto   4.22%     3.37%     4.79%
//
// Every table is symmetric (payout[s] === payout[rows - s]) with high multipliers
// at the edges (rare slots) and low ones in the center (the common slots), so the
// player almost always lands in a sub-1× center slot — that is where the edge lives.

import { fairFloat } from "./fairness.js";

export type PlinkoRisk = "bajo" | "medio" | "alto";

export type PlinkoRows = 8 | 12 | 16;

export interface PlinkoDetail {
  path: ("L" | "R")[];
  slot: number;
}

export interface PlinkoResult {
  multiplier: number;
  detail: PlinkoDetail;
}

/**
 * Symmetric payout tables (× stake) keyed by risk → rows → slot (0..rows).
 * Edges pay high, center pays sub-1×; each carries a documented ~3–5% house edge.
 */
export const PLINKO_PAYOUTS: Record<
  PlinkoRisk,
  Record<PlinkoRows, readonly number[]>
> = {
  bajo: {
    8: [5.5, 2.0, 1.1, 1.0, 0.4, 1.0, 1.1, 2.0, 5.5],
    12: [8.3, 3.0, 1.6, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.6, 3.0, 8.3],
    16: [
      15.6, 8.8, 2.0, 1.4, 1.3, 1.2, 1.1, 1.0, 0.4, 1.0, 1.1, 1.2, 1.3, 1.4,
      2.0, 8.8, 15.6,
    ],
  },
  medio: {
    8: [12.6, 2.9, 1.3, 0.7, 0.3, 0.7, 1.3, 2.9, 12.6],
    12: [39.3, 9.8, 3.3, 1.6, 1.0, 0.7, 0.4, 0.7, 1.0, 1.6, 3.3, 9.8, 39.3],
    16: [
      494.2, 57.8, 20.0, 8.9, 3.1, 0.9, 0.7, 0.4, 0.4, 0.4, 0.7, 0.9, 3.1, 8.9,
      20.0, 57.8, 494.2,
    ],
  },
  alto: {
    8: [29.1, 3.9, 1.5, 0.3, 0.1, 0.3, 1.5, 3.9, 29.1],
    12: [150.7, 19.8, 6.0, 1.8, 0.6, 0.4, 0.4, 0.4, 0.6, 1.8, 6.0, 19.8, 150.7],
    16: [
      852.8, 113.7, 36.5, 10.2, 3.0, 0.6, 0.4, 0.4, 0.4, 0.4, 0.4, 0.6, 3.0,
      10.2, 36.5, 113.7, 852.8,
    ],
  },
};

const isSupportedRows = (rows: number): rows is PlinkoRows =>
  rows === 8 || rows === 12 || rows === 16;

/**
 * Drop a Plinko ball. Each row's L/R bounce is derived from
 * fairFloat(serverSeed, clientSeed, nonce, row): < 0.5 → "L", else "R".
 * The landing slot is the count of "R" bounces (0..rows).
 */
export const resolvePlinko = (
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  rows: number,
  risk: PlinkoRisk,
): PlinkoResult => {
  if (!isSupportedRows(rows)) {
    throw new Error(`Plinko: unsupported rows ${rows} (expected 8, 12 or 16)`);
  }

  const path: ("L" | "R")[] = [];
  let slot = 0;
  for (let row = 0; row < rows; row += 1) {
    const roll = fairFloat(serverSeed, clientSeed, nonce, row);
    if (roll < 0.5) {
      path.push("L");
    } else {
      path.push("R");
      slot += 1;
    }
  }

  const table = PLINKO_PAYOUTS[risk][rows];
  const multiplier = table[slot] ?? 0;

  return { multiplier, detail: { path, slot } };
};

/** Human-readable summary of a Plinko drop. */
export const describePlinko = (
  detail: PlinkoDetail,
  multiplier: number,
): string => {
  const rows = detail.path.length;
  const trail = detail.path.join("");
  return `Plinko ${rows} filas → ranura ${detail.slot}/${rows} (${trail}) · ${multiplier}×`;
};
