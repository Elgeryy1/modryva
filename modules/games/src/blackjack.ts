// Provably-fair BLACKJACK helpers.
//
// Pure & deterministic: every card in the shoe derives from `fairShuffle`, so any
// hand is fully verifiable from (serverSeed, clientSeed, nonce). This module holds
// only the pure helpers; the API layer drives the interactive hit/stand loop and
// decides how many cards each side draws, then calls these to value hands, play the
// dealer, and settle.
//
// HOUSE EDGE (positive, by design): standard blackjack rules already carry a small
// house edge (~0.5% with perfect basic strategy under these rules: 6 decks, dealer
// stands on soft 17, blackjack pays 3:2). The edge here is structural rather than a
// tunable multiplier: a natural blackjack pays 3:2 (returns 2.5x stake), an ordinary
// win pays 1:1 (returns 2x stake), a push returns the stake (1x), and any loss —
// including the player busting BEFORE the dealer even draws — returns 0. Because the
// player must act first and busts are total losses regardless of what the dealer
// would have done, the house retains a positive expected value over time.

import { fairShuffle } from "./fairness.js";

/** A card rank 1..13 where 1 = Ace, 11/12/13 = J/Q/K (all worth 10). */
export type Rank = number;

/** Result of valuing a hand: best total <= 21 when possible, and whether an ace is soft. */
export interface HandValue {
  total: number;
  soft: boolean;
}

/** Outcome of a settled hand. */
export type BlackjackOutcome = "win" | "lose" | "push" | "blackjack";

export interface Settlement {
  outcome: BlackjackOutcome;
  multiplier: number;
}

/** Number of decks in a standard shoe. */
export const DEFAULT_DECKS = 6;

/**
 * The point value of a single card rank. Ace counts as 11 here; `handValue`
 * demotes aces to 1 as needed. J/Q/K (11/12/13) are all worth 10.
 */
const cardPoints = (rank: Rank): number => {
  if (rank === 1) {
    return 11;
  }
  if (rank >= 10) {
    return 10;
  }
  return rank;
};

/**
 * Best value of a hand under blackjack rules. Aces count as 11 unless that busts
 * the hand, in which case they are demoted to 1 one at a time. `soft` is true when
 * at least one ace is still counted as 11 in the returned total.
 */
export const handValue = (cards: Rank[]): HandValue => {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += cardPoints(card);
    if (card === 1) {
      aces += 1;
    }
  }
  // Demote aces (11 -> 1, i.e. subtract 10) while busting and any ace is still soft.
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 };
};

/** True when exactly two cards total 21 (a natural blackjack). */
export const isBlackjack = (cards: Rank[]): boolean =>
  cards.length === 2 && handValue(cards).total === 21;

/**
 * Build a verifiable shoe of ranks. The base shoe is `decks` ordered decks, each
 * containing 4 of every rank 1..13 (so 52*decks cards, and 4*decks of each rank).
 * `fairShuffle` produces a permutation of [0, size), which we apply to the base
 * ordering to get the dealt sequence. Fully determined by the seeds + nonce.
 */
export const buildShoe = (
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  decks: number = DEFAULT_DECKS,
): Rank[] => {
  const base: Rank[] = [];
  for (let d = 0; d < decks; d += 1) {
    for (let rank = 1; rank <= 13; rank += 1) {
      for (let count = 0; count < 4; count += 1) {
        base.push(rank);
      }
    }
  }
  const size = base.length;
  const order = fairShuffle(serverSeed, clientSeed, nonce, size);
  const shoe: Rank[] = new Array(size);
  for (let i = 0; i < size; i += 1) {
    const sourceIndex = order[i] ?? 0;
    shoe[i] = base[sourceIndex] ?? 1;
  }
  return shoe;
};

/**
 * Play out the dealer's hand from `startIndex` in the shoe. The dealer hits until
 * the total is at least 17, and STANDS on soft 17 (S17). `dealerCards` are the
 * dealer's already-dealt cards (its two initial cards); the stop decision is made
 * on the FULL hand (seed + drawn), while only the NEWLY drawn cards are returned
 * (the caller already has the initial ones). Returns those drawn cards and the
 * next unused index. If the shoe runs out, the dealer stops (defensive).
 */
export const dealerPlays = (
  shoe: Rank[],
  startIndex: number,
  dealerCards: Rank[] = [],
): { cards: Rank[]; nextIndex: number } => {
  const drawn: Rank[] = [];
  let index = startIndex;
  while (index < shoe.length) {
    const value = handValue([...dealerCards, ...drawn]);
    // Stand on hard 17+ and on soft 17.
    if (value.total >= 17) {
      break;
    }
    const card = shoe[index];
    if (card === undefined) {
      break;
    }
    drawn.push(card);
    index += 1;
  }
  return { cards: drawn, nextIndex: index };
};

/**
 * Settle a completed hand given the final player and dealer totals and whether the
 * player had a natural blackjack. Multipliers are x stake:
 *   - blackjack (natural, dealer not also natural): 2.5x (3:2 plus stake returned)
 *   - win: 2x (even money plus stake returned)
 *   - push: 1x (stake returned)
 *   - lose: 0x
 * A player total > 21 is a bust and always loses. The caller is responsible for
 * only passing playerBlackjack=true when the dealer does not also have a natural
 * (a natural-vs-natural situation should be settled as a push by the caller).
 */
export const settleBlackjack = (
  playerTotal: number,
  dealerTotal: number,
  playerBlackjack: boolean,
): Settlement => {
  if (playerTotal > 21) {
    return { outcome: "lose", multiplier: 0 };
  }
  if (playerBlackjack) {
    return { outcome: "blackjack", multiplier: 2.5 };
  }
  if (dealerTotal > 21) {
    return { outcome: "win", multiplier: 2 };
  }
  if (playerTotal > dealerTotal) {
    return { outcome: "win", multiplier: 2 };
  }
  if (playerTotal < dealerTotal) {
    return { outcome: "lose", multiplier: 0 };
  }
  return { outcome: "push", multiplier: 1 };
};

const RANK_LABELS: Record<number, string> = {
  1: "A",
  11: "J",
  12: "Q",
  13: "K",
};

/** Human-readable label for a single rank, e.g. "A", "10", "K". */
const rankLabel = (rank: Rank): string => RANK_LABELS[rank] ?? String(rank);

/**
 * A short human-readable summary of a settled hand, e.g.
 * "Player 20 vs Dealer 19 — win (x2)" or "Player [A,K]=21 blackjack! (x2.5)".
 */
export const describeBlackjack = (
  playerCards: Rank[],
  dealerCards: Rank[],
  settlement: Settlement,
): string => {
  const player = handValue(playerCards);
  const dealer = handValue(dealerCards);
  const playerHand = playerCards.map(rankLabel).join(",");
  const dealerHand = dealerCards.map(rankLabel).join(",");
  const verb =
    settlement.outcome === "blackjack"
      ? "blackjack!"
      : settlement.outcome === "push"
        ? "push"
        : settlement.outcome === "win"
          ? "win"
          : "lose";
  return `Player [${playerHand}]=${player.total}${player.soft ? " (soft)" : ""} vs Dealer [${dealerHand}]=${dealer.total}${dealer.soft ? " (soft)" : ""} — ${verb} (x${settlement.multiplier})`;
};
