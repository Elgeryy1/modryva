import { describe, expect, it } from "vitest";
import {
  type BaccaratBet,
  type BaccaratDeal,
  baccaratMultiplier,
  dealBaccarat,
  describeBaccarat,
} from "./baccarat.js";

const SS = "server-seed-abc";
const CS = "client-seed-xyz";
const EDGE = 0.02; // CASINO.houseEdge

describe("dealBaccarat", () => {
  it("returns bancaValue and jugadorValue each in [0, 9]", () => {
    for (let nonce = 0; nonce < 500; nonce += 1) {
      const d = dealBaccarat(SS, CS, nonce);
      expect(Number.isInteger(d.bancaValue)).toBe(true);
      expect(Number.isInteger(d.jugadorValue)).toBe(true);
      expect(d.bancaValue).toBeGreaterThanOrEqual(0);
      expect(d.bancaValue).toBeLessThanOrEqual(9);
      expect(d.jugadorValue).toBeGreaterThanOrEqual(0);
      expect(d.jugadorValue).toBeLessThanOrEqual(9);
    }
  });

  it("is deterministic for the same (serverSeed, clientSeed, nonce)", () => {
    for (let nonce = 0; nonce < 20; nonce += 1) {
      expect(dealBaccarat(SS, CS, nonce)).toEqual(dealBaccarat(SS, CS, nonce));
    }
  });

  it("draws banca and jugador independently (not always equal)", () => {
    let sawDifferent = false;
    for (let nonce = 0; nonce < 200; nonce += 1) {
      const d = dealBaccarat(SS, CS, nonce);
      if (d.bancaValue !== d.jugadorValue) {
        sawDifferent = true;
        break;
      }
    }
    expect(sawDifferent).toBe(true);
  });

  it("covers both boundary values (0 and 9) across the nonce space", () => {
    const bancaSeen = new Set<number>();
    const jugadorSeen = new Set<number>();
    for (let nonce = 0; nonce < 2000; nonce += 1) {
      const d = dealBaccarat(SS, CS, nonce);
      bancaSeen.add(d.bancaValue);
      jugadorSeen.add(d.jugadorValue);
    }
    expect(bancaSeen.has(0)).toBe(true);
    expect(bancaSeen.has(9)).toBe(true);
    expect(jugadorSeen.has(0)).toBe(true);
    expect(jugadorSeen.has(9)).toBe(true);
  });
});

describe("baccaratMultiplier — player bet", () => {
  it("wins when jugadorValue > bancaValue", () => {
    const deal: BaccaratDeal = { bancaValue: 3, jugadorValue: 7 };
    const bet: BaccaratBet = { kind: "player" };
    expect(baccaratMultiplier(bet, deal, EDGE)).toBeGreaterThan(0);
  });

  it("loses when jugadorValue <= bancaValue", () => {
    const bet: BaccaratBet = { kind: "player" };
    expect(
      baccaratMultiplier(bet, { bancaValue: 7, jugadorValue: 3 }, EDGE),
    ).toBe(0);
    expect(
      baccaratMultiplier(bet, { bancaValue: 5, jugadorValue: 5 }, EDGE),
    ).toBe(0);
  });
});

describe("baccaratMultiplier — banker bet", () => {
  it("wins when bancaValue > jugadorValue", () => {
    const deal: BaccaratDeal = { bancaValue: 8, jugadorValue: 2 };
    const bet: BaccaratBet = { kind: "banker" };
    expect(baccaratMultiplier(bet, deal, EDGE)).toBeGreaterThan(0);
  });

  it("loses when bancaValue <= jugadorValue", () => {
    const bet: BaccaratBet = { kind: "banker" };
    expect(
      baccaratMultiplier(bet, { bancaValue: 2, jugadorValue: 8 }, EDGE),
    ).toBe(0);
    expect(
      baccaratMultiplier(bet, { bancaValue: 4, jugadorValue: 4 }, EDGE),
    ).toBe(0);
  });
});

describe("baccaratMultiplier — tie bet", () => {
  it("wins on an exact tie", () => {
    const bet: BaccaratBet = { kind: "tie" };
    for (let v = 0; v <= 9; v += 1) {
      expect(
        baccaratMultiplier(bet, { bancaValue: v, jugadorValue: v }, EDGE),
      ).toBeGreaterThan(0);
    }
  });

  it("loses when values differ", () => {
    const bet: BaccaratBet = { kind: "tie" };
    expect(
      baccaratMultiplier(bet, { bancaValue: 1, jugadorValue: 2 }, EDGE),
    ).toBe(0);
  });
});

describe("baccaratMultiplier — exact house-edge derivation", () => {
  // Exact probabilities over the 100 (banca, jugador) combinations in [0,9]²:
  //   player wins: sum_{b=0}^{9} (9 - b) = 45  → chance 0.45
  //   banker wins: by symmetry, also 45        → chance 0.45
  //   tie:         b === j, 10 combos          → chance 0.10
  // multiplier = (1 / chance) * (1 - edge), rounded to 2 decimals.
  it("counts the exact combinations by brute force", () => {
    let playerWins = 0;
    let bankerWins = 0;
    let ties = 0;
    for (let b = 0; b <= 9; b += 1) {
      for (let j = 0; j <= 9; j += 1) {
        if (j > b) playerWins += 1;
        else if (b > j) bankerWins += 1;
        else ties += 1;
      }
    }
    expect(playerWins).toBe(45);
    expect(bankerWins).toBe(45);
    expect(ties).toBe(10);
    expect(playerWins + bankerWins + ties).toBe(100);
  });

  it("player/banker multiplier equals (1/0.45) * (1-edge)", () => {
    const expected = Math.round((1 / 0.45) * (1 - EDGE) * 100) / 100;
    expect(
      baccaratMultiplier(
        { kind: "player" },
        { bancaValue: 0, jugadorValue: 9 },
        EDGE,
      ),
    ).toBe(expected);
    expect(
      baccaratMultiplier(
        { kind: "banker" },
        { bancaValue: 9, jugadorValue: 0 },
        EDGE,
      ),
    ).toBe(expected);
    expect(expected).toBeCloseTo(2.18, 2);
  });

  it("tie multiplier equals (1/0.10) * (1-edge) = 9.8", () => {
    const expected = Math.round((1 / 0.1) * (1 - EDGE) * 100) / 100;
    expect(
      baccaratMultiplier(
        { kind: "tie" },
        { bancaValue: 4, jugadorValue: 4 },
        EDGE,
      ),
    ).toBe(expected);
    expect(expected).toBe(9.8);
  });

  it("default edge (no override) matches CASINO.houseEdge = 0.02", () => {
    const deal: BaccaratDeal = { bancaValue: 0, jugadorValue: 9 };
    expect(baccaratMultiplier({ kind: "player" }, deal)).toBe(
      baccaratMultiplier({ kind: "player" }, deal, 0.02),
    );
  });
});

describe("describeBaccarat", () => {
  it("renders a win with the multiplier", () => {
    const s = describeBaccarat(
      { bancaValue: 3, jugadorValue: 7 },
      { kind: "player" },
      2.18,
    );
    expect(s).toContain("Banca 3");
    expect(s).toContain("Jugador 7");
    expect(s).toContain("2.18×");
    expect(s).toContain("GANA");
  });

  it("renders a loss", () => {
    const s = describeBaccarat(
      { bancaValue: 7, jugadorValue: 3 },
      { kind: "player" },
      0,
    );
    expect(s).toContain("no gana");
  });
});
