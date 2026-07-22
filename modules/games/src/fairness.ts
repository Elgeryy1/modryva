// Provably-fair commit-reveal core for the casino. Pure + deterministic given
// the seeds, so anyone can independently verify any outcome.
//
// Flow (industry-standard "commit-reveal"):
//   1. Server generates a random serverSeed and publishes commit = sha256(serverSeed)
//      BEFORE any bet is placed (so it cannot pick a seed after seeing the bet).
//   2. The client supplies (or is assigned) a clientSeed. A nonce increments per bet.
//   3. Each outcome is derived from HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}:${cursor}`).
//   4. After the round the server REVEALS serverSeed; anyone recomputes the commit
//      and every outcome, proving the result was fixed in advance and independent
//      of the bet. This is the same byte-stream → float scheme used by Stake et al.

import { createHash, createHmac, randomBytes } from "node:crypto";

/** Fresh 32-byte server seed (hex). Keep secret until reveal. */
export const newServerSeed = (): string => randomBytes(32).toString("hex");

/** Public commitment shown before the bet. */
export const commit = (serverSeed: string): string =>
  createHash("sha256").update(serverSeed).digest("hex");

/** Verifies a revealed serverSeed matches the commitment shown up front. */
export const verifyCommit = (serverSeed: string, commitHash: string): boolean =>
  commit(serverSeed) === commitHash;

const streamBytes = (
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  cursor: number,
): Buffer =>
  createHmac("sha256", serverSeed)
    .update(`${clientSeed}:${nonce}:${cursor}`)
    .digest();

/**
 * A uniform float in [0, 1) from the first 4 bytes of the HMAC stream. No modulo:
 * the bytes are read as a base-256 fraction, the standard provably-fair mapping.
 */
export const fairFloat = (
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  cursor = 0,
): number => {
  const bytes = streamBytes(serverSeed, clientSeed, nonce, cursor);
  return (
    (bytes[0] ?? 0) / 256 +
    (bytes[1] ?? 0) / 256 ** 2 +
    (bytes[2] ?? 0) / 256 ** 3 +
    (bytes[3] ?? 0) / 256 ** 4
  );
};

/** Uniform integer in [min, max] inclusive. */
export const fairInt = (
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  min: number,
  max: number,
): number => {
  if (max <= min) {
    return min;
  }
  const span = max - min + 1;
  return min + Math.floor(fairFloat(serverSeed, clientSeed, nonce) * span);
};

/**
 * A deterministic, verifiable Fisher-Yates permutation of [0, n) — used for
 * shuffled shoes (blackjack), hidden mine layouts (mines), and draws (keno).
 * Each swap draws from a distinct cursor so the whole shuffle is reproducible.
 */
export const fairShuffle = (
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  n: number,
): number[] => {
  const order = Array.from({ length: n }, (_, index) => index);
  for (let i = n - 1; i > 0; i -= 1) {
    const roll = fairFloat(serverSeed, clientSeed, nonce, n - 1 - i);
    const j = Math.floor(roll * (i + 1));
    const tmp = order[i] as number;
    order[i] = order[j] as number;
    order[j] = tmp;
  }
  return order;
};
