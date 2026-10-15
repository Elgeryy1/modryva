import { describe, expect, it } from "vitest";
import {
  describeRoulette,
  RED_NUMBERS,
  type RouletteBet,
  rouletteMultiplier,
  spinRoulette,
} from "./roulette.js";

const SS = "server-seed-abc";
const CS = "client-seed-xyz";

describe("spinRoulette", () => {
  it("returns a pocket in [0, 36]", () => {
    for (let nonce = 0; nonce < 500; nonce += 1) {
      const p = spinRoulette(SS, CS, nonce);
      expect(Number.isInteger(p)).toBe(true);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(36);
    }
  });

  it("is deterministic for the same (serverSeed, clientSeed, nonce)", () => {
    for (let nonce = 0; nonce < 20; nonce += 1) {
      expect(spinRoulette(SS, CS, nonce)).toBe(spinRoulette(SS, CS, nonce));
    }
  });

  it("covers 0 and 36 across the nonce space (edge pockets are reachable)", () => {
    const seen = new Set<number>();
    for (let nonce = 0; nonce < 2000; nonce += 1) {
      seen.add(spinRoulette(SS, CS, nonce));
    }
    expect(seen.has(0)).toBe(true);
    expect(seen.has(36)).toBe(true);
    expect(seen.size).toBe(37);
  });
});

describe("RED_NUMBERS", () => {
  it("has exactly 18 red numbers, all in 1..36", () => {
    expect(RED_NUMBERS.size).toBe(18);
    for (const n of RED_NUMBERS) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(36);
    }
  });

  it("does not include 0", () => {
    expect(RED_NUMBERS.has(0)).toBe(false);
  });
});

describe("rouletteMultiplier — zero handling", () => {
  const outside: RouletteBet[] = [
    { kind: "red" },
    { kind: "black" },
    { kind: "odd" },
    { kind: "even" },
    { kind: "low" },
    { kind: "high" },
    { kind: "dozen", index: 1 },
    { kind: "dozen", index: 2 },
    { kind: "dozen", index: 3 },
    { kind: "column", index: 1 },
    { kind: "column", index: 2 },
    { kind: "column", index: 3 },
  ];

  it("pocket 0 loses every outside bet", () => {
    for (const bet of outside) {
      expect(rouletteMultiplier(bet, 0)).toBe(0);
    }
  });

  it("a straight bet on 0 pays 36 when 0 hits", () => {
    expect(rouletteMultiplier({ kind: "straight", n: 0 }, 0)).toBe(36);
  });

  it("a straight bet on a non-zero number loses when 0 hits", () => {
    expect(rouletteMultiplier({ kind: "straight", n: 17 }, 0)).toBe(0);
  });
});

describe("rouletteMultiplier — straight", () => {
  it("pays 36 on exact match, 0 otherwise", () => {
    expect(rouletteMultiplier({ kind: "straight", n: 17 }, 17)).toBe(36);
    expect(rouletteMultiplier({ kind: "straight", n: 17 }, 18)).toBe(0);
    expect(rouletteMultiplier({ kind: "straight", n: 36 }, 36)).toBe(36);
  });
});

describe("rouletteMultiplier — red/black correctness", () => {
  it("red pays on red pockets only", () => {
    expect(rouletteMultiplier({ kind: "red" }, 1)).toBe(2); // 1 is red
    expect(rouletteMultiplier({ kind: "red" }, 2)).toBe(0); // 2 is black
  });

  it("black pays on black pockets only", () => {
    expect(rouletteMultiplier({ kind: "black" }, 2)).toBe(2); // 2 is black
    expect(rouletteMultiplier({ kind: "black" }, 1)).toBe(0); // 1 is red
  });

  it("every non-zero pocket is exactly one of red or black", () => {
    for (let p = 1; p <= 36; p += 1) {
      const red = rouletteMultiplier({ kind: "red" }, p);
      const black = rouletteMultiplier({ kind: "black" }, p);
      // exactly one pays
      expect(red + black).toBe(2);
    }
  });
});

describe("rouletteMultiplier — odd/even/low/high", () => {
  it("odd pays on odd, even on even", () => {
    expect(rouletteMultiplier({ kind: "odd" }, 7)).toBe(2);
    expect(rouletteMultiplier({ kind: "odd" }, 8)).toBe(0);
    expect(rouletteMultiplier({ kind: "even" }, 8)).toBe(2);
    expect(rouletteMultiplier({ kind: "even" }, 7)).toBe(0);
  });

  it("low = 1..18, high = 19..36", () => {
    expect(rouletteMultiplier({ kind: "low" }, 1)).toBe(2);
    expect(rouletteMultiplier({ kind: "low" }, 18)).toBe(2);
    expect(rouletteMultiplier({ kind: "low" }, 19)).toBe(0);
    expect(rouletteMultiplier({ kind: "high" }, 19)).toBe(2);
    expect(rouletteMultiplier({ kind: "high" }, 36)).toBe(2);
    expect(rouletteMultiplier({ kind: "high" }, 18)).toBe(0);
  });
});

describe("rouletteMultiplier — dozen/column", () => {
  it("dozens split 1..12 / 13..24 / 25..36", () => {
    expect(rouletteMultiplier({ kind: "dozen", index: 1 }, 12)).toBe(3);
    expect(rouletteMultiplier({ kind: "dozen", index: 1 }, 13)).toBe(0);
    expect(rouletteMultiplier({ kind: "dozen", index: 2 }, 13)).toBe(3);
    expect(rouletteMultiplier({ kind: "dozen", index: 2 }, 24)).toBe(3);
    expect(rouletteMultiplier({ kind: "dozen", index: 3 }, 25)).toBe(3);
    expect(rouletteMultiplier({ kind: "dozen", index: 3 }, 36)).toBe(3);
  });

  it("columns follow the 1,4,7.. / 2,5,8.. / 3,6,9.. pattern", () => {
    expect(rouletteMultiplier({ kind: "column", index: 1 }, 1)).toBe(3);
    expect(rouletteMultiplier({ kind: "column", index: 1 }, 34)).toBe(3);
    expect(rouletteMultiplier({ kind: "column", index: 2 }, 2)).toBe(3);
    expect(rouletteMultiplier({ kind: "column", index: 2 }, 35)).toBe(3);
    expect(rouletteMultiplier({ kind: "column", index: 3 }, 3)).toBe(3);
    expect(rouletteMultiplier({ kind: "column", index: 3 }, 36)).toBe(3);
    // wrong column loses
    expect(rouletteMultiplier({ kind: "column", index: 2 }, 1)).toBe(0);
  });

  it("each non-zero pocket belongs to exactly one dozen and one column", () => {
    for (let p = 1; p <= 36; p += 1) {
      const dozenHits =
        (rouletteMultiplier({ kind: "dozen", index: 1 }, p) > 0 ? 1 : 0) +
        (rouletteMultiplier({ kind: "dozen", index: 2 }, p) > 0 ? 1 : 0) +
        (rouletteMultiplier({ kind: "dozen", index: 3 }, p) > 0 ? 1 : 0);
      const columnHits =
        (rouletteMultiplier({ kind: "column", index: 1 }, p) > 0 ? 1 : 0) +
        (rouletteMultiplier({ kind: "column", index: 2 }, p) > 0 ? 1 : 0) +
        (rouletteMultiplier({ kind: "column", index: 3 }, p) > 0 ? 1 : 0);
      expect(dozenHits).toBe(1);
      expect(columnHits).toBe(1);
    }
  });
});

describe("house edge (documented 1/37 ≈ 2.70%)", () => {
  it("straight bet EV over all 37 equally-likely pockets is 36/37", () => {
    let ev = 0;
    for (let p = 0; p <= 36; p += 1) {
      ev += rouletteMultiplier({ kind: "straight", n: 17 }, p);
    }
    ev /= 37;
    expect(ev).toBeCloseTo(36 / 37, 12);
  });

  it("red bet EV over all 37 pockets is 36/37 (18 reds pay 2×)", () => {
    let ev = 0;
    for (let p = 0; p <= 36; p += 1) {
      ev += rouletteMultiplier({ kind: "red" }, p);
    }
    ev /= 37;
    expect(ev).toBeCloseTo((18 * 2) / 37, 12);
    expect(ev).toBeCloseTo(36 / 37, 12);
  });
});

describe("describeRoulette", () => {
  it("renders a win with the multiplier", () => {
    const s = describeRoulette(1, { kind: "red" }, 2);
    expect(s).toContain("1 (red)");
    expect(s).toContain("2×");
    expect(s).toContain("WIN");
  });

  it("renders a loss", () => {
    const s = describeRoulette(0, { kind: "red" }, 0);
    expect(s).toContain("0 (green)");
    expect(s).toContain("no win");
  });

  it("labels straight and grouped bets", () => {
    expect(describeRoulette(17, { kind: "straight", n: 17 }, 36)).toContain(
      "straight 17",
    );
    expect(describeRoulette(5, { kind: "dozen", index: 1 }, 3)).toContain(
      "dozen 1",
    );
  });
});
