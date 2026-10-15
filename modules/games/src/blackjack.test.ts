import { describe, expect, it } from "vitest";
import {
  buildShoe,
  DEFAULT_DECKS,
  dealerPlays,
  describeBlackjack,
  handValue,
  isBlackjack,
  settleBlackjack,
} from "./blackjack.js";

const SS = "server-seed-abc";
const CS = "client-seed-xyz";

describe("handValue", () => {
  it("sums number cards straight", () => {
    expect(handValue([5, 7])).toEqual({ total: 12, soft: false });
  });

  it("counts J/Q/K as 10", () => {
    expect(handValue([11, 12])).toEqual({ total: 20, soft: false });
    expect(handValue([13, 9])).toEqual({ total: 19, soft: false });
  });

  it("counts a lone ace as soft 11", () => {
    expect(handValue([1, 6])).toEqual({ total: 17, soft: true });
  });

  it("makes a natural blackjack 21 soft", () => {
    expect(handValue([1, 13])).toEqual({ total: 21, soft: true });
  });

  it("demotes an ace from 11 to 1 to avoid busting", () => {
    // A + 6 + 10 => 11+6+10 = 27 busts, demote ace => 17 hard
    expect(handValue([1, 6, 10])).toEqual({ total: 17, soft: false });
  });

  it("keeps one ace soft with two aces", () => {
    // A + A => 11 + 1 = 12, one ace still soft
    expect(handValue([1, 1])).toEqual({ total: 12, soft: true });
  });

  it("demotes both aces when needed", () => {
    // A + A + 10 + 9 => 1 + 1 + 10 + 9 = 21 hard
    expect(handValue([1, 1, 10, 9])).toEqual({ total: 21, soft: false });
  });

  it("values an empty hand as 0", () => {
    expect(handValue([])).toEqual({ total: 0, soft: false });
  });
});

describe("isBlackjack", () => {
  it("is true for a two-card 21", () => {
    expect(isBlackjack([1, 10])).toBe(true);
    expect(isBlackjack([1, 13])).toBe(true);
  });

  it("is false for a three-card 21", () => {
    expect(isBlackjack([7, 7, 7])).toBe(false);
  });

  it("is false for non-21 two-card hands", () => {
    expect(isBlackjack([1, 9])).toBe(false);
  });
});

describe("buildShoe", () => {
  it("has the right size for 6 decks", () => {
    const shoe = buildShoe(SS, CS, 1);
    expect(shoe.length).toBe(52 * DEFAULT_DECKS);
  });

  it("contains exactly 24 of each rank for 6 decks", () => {
    const shoe = buildShoe(SS, CS, 1);
    for (let rank = 1; rank <= 13; rank += 1) {
      const count = shoe.filter((c) => c === rank).length;
      expect(count).toBe(4 * DEFAULT_DECKS);
    }
  });

  it("honours a custom deck count", () => {
    const shoe = buildShoe(SS, CS, 1, 1);
    expect(shoe.length).toBe(52);
    for (let rank = 1; rank <= 13; rank += 1) {
      expect(shoe.filter((c) => c === rank).length).toBe(4);
    }
  });

  it("only contains ranks 1..13", () => {
    const shoe = buildShoe(SS, CS, 3);
    for (const card of shoe) {
      expect(card).toBeGreaterThanOrEqual(1);
      expect(card).toBeLessThanOrEqual(13);
    }
  });

  it("is deterministic for the same seeds and nonce", () => {
    expect(buildShoe(SS, CS, 7)).toEqual(buildShoe(SS, CS, 7));
  });

  it("differs across nonces", () => {
    expect(buildShoe(SS, CS, 1)).not.toEqual(buildShoe(SS, CS, 2));
  });
});

describe("dealerPlays", () => {
  it("stands immediately on a hard 17+", () => {
    const shoe = [10, 7, 5, 5, 5]; // dealer starts 10+7=17
    const { cards, nextIndex } = dealerPlays(shoe, 0);
    expect(handValue(cards).total).toBe(17);
    expect(cards.length).toBe(2);
    expect(nextIndex).toBe(2);
  });

  it("stands on soft 17 (S17)", () => {
    const shoe = [1, 6, 5]; // A + 6 = soft 17, must stand and not take the 5
    const { cards, nextIndex } = dealerPlays(shoe, 0);
    expect(handValue(cards)).toEqual({ total: 17, soft: true });
    expect(cards.length).toBe(2);
    expect(nextIndex).toBe(2);
  });

  it("hits below 17 until reaching 17+", () => {
    const shoe = [5, 6, 4, 9]; // 5+6=11 hit ->4=15 hit ->9=24? demote none, 15+9=24 bust
    const { cards } = dealerPlays(shoe, 0);
    expect(handValue(cards).total).toBeGreaterThanOrEqual(17);
  });

  it("respects a non-zero start index", () => {
    const shoe = [2, 2, 10, 7]; // start at index 2 => 10+7=17
    const { cards, nextIndex } = dealerPlays(shoe, 2);
    expect(handValue(cards).total).toBe(17);
    expect(nextIndex).toBe(4);
  });

  it("stops gracefully when the shoe is exhausted", () => {
    const shoe = [5, 5]; // 10, still <17 but no more cards
    const { cards, nextIndex } = dealerPlays(shoe, 0);
    expect(cards).toEqual([5, 5]);
    expect(nextIndex).toBe(2);
  });

  it("stands on a SEEDED initial hand already at 17+ (draws nothing)", () => {
    // Dealer's two initial cards total 20; it must not draw on top of them.
    const shoe = [5, 5, 5];
    const { cards, nextIndex } = dealerPlays(shoe, 0, [10, 10]);
    expect(cards).toEqual([]);
    expect(nextIndex).toBe(0);
  });

  it("evaluates the stop on the FULL hand (seed + drawn), not just drawn cards", () => {
    // Seed 10+6=16 (<17) → draws one 5 → 21 → stops. Ignoring the seed (the old
    // bug) would keep hitting far past 21.
    const shoe = [5, 9, 9];
    const { cards, nextIndex } = dealerPlays(shoe, 0, [10, 6]);
    expect(cards).toEqual([5]);
    expect(handValue([10, 6, ...cards]).total).toBe(21);
    expect(nextIndex).toBe(1);
  });
});

describe("settleBlackjack", () => {
  it("pays 2.5x for a natural blackjack", () => {
    expect(settleBlackjack(21, 20, true)).toEqual({
      outcome: "blackjack",
      multiplier: 2.5,
    });
  });

  it("pays 2x for an ordinary win", () => {
    expect(settleBlackjack(20, 18, false)).toEqual({
      outcome: "win",
      multiplier: 2,
    });
  });

  it("pays 2x when the dealer busts", () => {
    expect(settleBlackjack(18, 25, false)).toEqual({
      outcome: "win",
      multiplier: 2,
    });
  });

  it("returns the stake (1x) on a push", () => {
    expect(settleBlackjack(19, 19, false)).toEqual({
      outcome: "push",
      multiplier: 1,
    });
  });

  it("pays 0 on a straight loss", () => {
    expect(settleBlackjack(17, 20, false)).toEqual({
      outcome: "lose",
      multiplier: 0,
    });
  });

  it("pays 0 when the player busts, regardless of dealer", () => {
    expect(settleBlackjack(22, 30, false)).toEqual({
      outcome: "lose",
      multiplier: 0,
    });
  });

  it("player bust loses even if flagged blackjack (defensive)", () => {
    expect(settleBlackjack(22, 20, true).multiplier).toBe(0);
  });
});

describe("describeBlackjack", () => {
  it("labels a blackjack with card names", () => {
    const s = settleBlackjack(21, 18, true);
    const text = describeBlackjack([1, 13], [10, 8], s);
    expect(text).toContain("A,K");
    expect(text).toContain("blackjack!");
    expect(text).toContain("x2.5");
  });

  it("labels a plain win", () => {
    const s = settleBlackjack(20, 18, false);
    const text = describeBlackjack([10, 10], [10, 8], s);
    expect(text).toContain("win");
    expect(text).toContain("x2");
  });

  it("marks soft hands", () => {
    const s = settleBlackjack(17, 18, false);
    const text = describeBlackjack([1, 6], [10, 8], s);
    expect(text).toContain("(soft)");
  });
});

describe("end-to-end determinism", () => {
  it("plays a full hand reproducibly from the shoe", () => {
    const nonce = 42;
    const shoeA = buildShoe(SS, CS, nonce);
    const shoeB = buildShoe(SS, CS, nonce);
    // Deal player two, dealer two, then dealer draws from index 4.
    const playerCards = [shoeA[0] ?? 1, shoeA[1] ?? 1];
    const dealerUp = [shoeA[2] ?? 1, shoeA[3] ?? 1];
    const dealerResult = dealerPlays(shoeA, 4);
    const dealerFull = [...dealerUp, ...dealerResult.cards];
    const settlement = settleBlackjack(
      handValue(playerCards).total,
      handValue(dealerFull).total,
      isBlackjack(playerCards),
    );
    // Re-run on the identical shoe -> identical settlement.
    const settlement2 = settleBlackjack(
      handValue([shoeB[0] ?? 1, shoeB[1] ?? 1]).total,
      handValue([shoeB[2] ?? 1, shoeB[3] ?? 1, ...dealerPlays(shoeB, 4).cards])
        .total,
      isBlackjack([shoeB[0] ?? 1, shoeB[1] ?? 1]),
    );
    expect(settlement).toEqual(settlement2);
    expect(typeof settlement.multiplier).toBe("number");
  });
});
