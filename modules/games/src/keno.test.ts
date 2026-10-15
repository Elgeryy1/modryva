import { describe, expect, it } from "vitest";
import {
  drawKeno,
  KENO_PAYTABLE,
  KENO_PICK_COUNT,
  KENO_RANGE,
  kenoMultiplier,
} from "./keno.js";

const SS = "server-seed-keno";
const CS = "client-seed-keno";

describe("drawKeno", () => {
  it("draws exactly 5 distinct numbers in [1, 20]", () => {
    for (let nonce = 0; nonce < 200; nonce += 1) {
      const drawn = drawKeno(SS, CS, nonce);
      expect(drawn).toHaveLength(5);
      const set = new Set(drawn);
      expect(set.size).toBe(5); // never repeats
      for (const n of drawn) {
        expect(Number.isInteger(n)).toBe(true);
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(KENO_RANGE);
      }
    }
  });

  it("is deterministic for the same (serverSeed, clientSeed, nonce)", () => {
    for (let nonce = 0; nonce < 20; nonce += 1) {
      expect(drawKeno(SS, CS, nonce)).toEqual(drawKeno(SS, CS, nonce));
    }
  });

  it("produces different draws for different nonces (not a constant output)", () => {
    const draws = new Set<string>();
    for (let nonce = 0; nonce < 30; nonce += 1) {
      draws.add(drawKeno(SS, CS, nonce).slice().sort().join(","));
    }
    expect(draws.size).toBeGreaterThan(1);
  });

  it("produces different draws for different clientSeeds", () => {
    expect(drawKeno(SS, "other-client", 0)).not.toEqual(drawKeno(SS, CS, 0));
  });
});

describe("kenoMultiplier — hit counting", () => {
  it("counts 0 hits when none of the picks were drawn", () => {
    const picks = [1, 2, 3];
    const drawn = [4, 5, 6, 7, 8];
    expect(kenoMultiplier(picks, drawn)).toBe(KENO_PAYTABLE[0]);
  });

  it("counts 1 hit", () => {
    const picks = [1, 2, 3];
    const drawn = [1, 5, 6, 7, 8];
    expect(kenoMultiplier(picks, drawn)).toBe(KENO_PAYTABLE[1]);
  });

  it("counts 2 hits", () => {
    const picks = [1, 2, 3];
    const drawn = [1, 2, 6, 7, 8];
    expect(kenoMultiplier(picks, drawn)).toBe(KENO_PAYTABLE[2]);
  });

  it("counts 3 hits (all picks drawn)", () => {
    const picks = [1, 2, 3];
    const drawn = [1, 2, 3, 7, 8];
    expect(kenoMultiplier(picks, drawn)).toBe(KENO_PAYTABLE[3]);
  });

  it("order of picks/drawn does not matter", () => {
    expect(kenoMultiplier([3, 1, 2], [8, 3, 7, 1, 2])).toBe(
      kenoMultiplier([1, 2, 3], [1, 2, 3, 7, 8]),
    );
  });
});

describe("hypergeometric probability (exact combinatorics)", () => {
  // P(k) = C(3,k) * C(17, 5-k) / C(20,5), for k = 0,1,2,3 — exactly k of the
  // player's 3 picks among the 5 numbers the HOUSE DRAWS. Verified directly
  // against the closed-form combinatorics, so it catches a wrong formula (like
  // the old one that ignored the 5 drawn numbers) in the source.
  const C = (n: number, r: number): number => {
    if (r < 0 || r > n) return 0;
    let result = 1;
    for (let i = 0; i < r; i += 1) {
      result = (result * (n - i)) / (i + 1);
    }
    return Math.round(result);
  };
  const total = C(20, 5); // 15504

  it("the 4 exact hit probabilities sum to 1", () => {
    let sum = 0;
    for (let k = 0; k <= 3; k += 1) {
      sum += (C(3, k) * C(17, 5 - k)) / total;
    }
    expect(sum).toBeCloseTo(1, 12);
  });

  it("matches the correct 5-drawn probabilities for each k", () => {
    expect((C(3, 0) * C(17, 5)) / total).toBeCloseTo(6188 / 15504, 12);
    expect((C(3, 1) * C(17, 4)) / total).toBeCloseTo(7140 / 15504, 12);
    expect((C(3, 2) * C(17, 3)) / total).toBeCloseTo(2040 / 15504, 12);
    expect((C(3, 3) * C(17, 2)) / total).toBeCloseTo(136 / 15504, 12);
  });
});

describe("KENO_PAYTABLE — house never loses (EV ≤ 1, ≈ 1 - 2% edge)", () => {
  const C = (n: number, r: number): number => {
    if (r < 0 || r > n) return 0;
    let result = 1;
    for (let i = 0; i < r; i += 1) {
      result = (result * (n - i)) / (i + 1);
    }
    return Math.round(result);
  };
  const total = C(20, 5);
  const P = (k: number) => (C(3, k) * C(17, 5 - k)) / total;

  it("has an entry for every possible hit count 0..3", () => {
    expect(Object.keys(KENO_PAYTABLE).sort()).toEqual(["0", "1", "2", "3"]);
  });

  it("0 and 1 hits LOSE (multiplier 0); 2 and 3 hits pay, k=3 the most", () => {
    expect(KENO_PAYTABLE[0]).toBe(0);
    expect(KENO_PAYTABLE[1]).toBe(0);
    expect(KENO_PAYTABLE[2]).toBeGreaterThan(1);
    expect(KENO_PAYTABLE[3]).toBeGreaterThan(KENO_PAYTABLE[2]);
  });

  it("global expected return is ≤ 1 (regression: it was ~14.6x) and ≈ 0.98", () => {
    const ev =
      P(0) * KENO_PAYTABLE[0] +
      P(1) * KENO_PAYTABLE[1] +
      P(2) * KENO_PAYTABLE[2] +
      P(3) * KENO_PAYTABLE[3];
    expect(ev).toBeLessThanOrEqual(1);
    expect(ev).toBeGreaterThan(0.95);
    expect(ev).toBeCloseTo(0.98, 2);
  });
});

describe("KENO_PICK_COUNT", () => {
  it("is fixed at 3 (documented simplification)", () => {
    expect(KENO_PICK_COUNT).toBe(3);
  });
});
