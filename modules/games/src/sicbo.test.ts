import { describe, expect, it } from "vitest";
import {
  describeSicBo,
  rollSicBo,
  type SicBoBet,
  sicBoMultiplier,
  sicBoPayoutMultiplier,
} from "./sicbo.js";

const SS = "server-seed-abc";
const CS = "client-seed-xyz";

describe("rollSicBo", () => {
  it("returns three dice each in [1, 6]", () => {
    for (let nonce = 0; nonce < 500; nonce += 1) {
      const { d1, d2, d3 } = rollSicBo(SS, CS, nonce);
      for (const d of [d1, d2, d3]) {
        expect(Number.isInteger(d)).toBe(true);
        expect(d).toBeGreaterThanOrEqual(1);
        expect(d).toBeLessThanOrEqual(6);
      }
    }
  });

  it("is deterministic for the same (serverSeed, clientSeed, nonce)", () => {
    for (let nonce = 0; nonce < 50; nonce += 1) {
      expect(rollSicBo(SS, CS, nonce)).toEqual(rollSicBo(SS, CS, nonce));
    }
  });

  it("nonce 0 -> {6,1,1} (small, non-triple, sum 8)", () => {
    expect(rollSicBo(SS, CS, 0)).toEqual({ d1: 6, d2: 1, d3: 1 });
  });

  it("nonce 1 -> {2,6,6} (big, non-triple, sum 14)", () => {
    expect(rollSicBo(SS, CS, 1)).toEqual({ d1: 2, d2: 6, d3: 6 });
  });

  it("nonce 66 -> {1,1,1} (triple any, sum 3)", () => {
    expect(rollSicBo(SS, CS, 66)).toEqual({ d1: 1, d2: 1, d3: 1 });
  });

  it("nonce 103 -> {3,3,3} (triple any inside the small sum range)", () => {
    expect(rollSicBo(SS, CS, 103)).toEqual({ d1: 3, d2: 3, d3: 3 });
  });

  it("nonce 186 -> {5,5,5} (specific triple, sum 15)", () => {
    expect(rollSicBo(SS, CS, 186)).toEqual({ d1: 5, d2: 5, d3: 5 });
  });

  it("differs across nonces (not a constant stream)", () => {
    expect(rollSicBo(SS, CS, 0)).not.toEqual(rollSicBo(SS, CS, 1));
  });
});

describe("sicBoPayoutMultiplier", () => {
  it("small/big: floor((1/(105/216)) * 0.98 * 100) / 100 = 2.01", () => {
    expect(sicBoPayoutMultiplier("small")).toBeCloseTo(2.01, 2);
    expect(sicBoPayoutMultiplier("big")).toBeCloseTo(2.01, 2);
  });

  it("specific triple: floor((1/(1/216)) * 0.98 * 100) / 100 = 211.68", () => {
    expect(sicBoPayoutMultiplier("triple")).toBeCloseTo(211.68, 2);
  });

  it("respects a custom house edge", () => {
    const noEdge = sicBoPayoutMultiplier("small", 0);
    // floor((216/105) * 100) / 100 truncates 2.0571... down to 2.05.
    expect(noEdge).toBe(Math.floor((216 / 105) * 100) / 100);
  });
});

describe("sicBoMultiplier", () => {
  const small: SicBoBet = { kind: "small" };
  const big: SicBoBet = { kind: "big" };

  it("small wins on a non-triple sum in [4, 10]", () => {
    const roll = { d1: 6, d2: 1, d3: 1 }; // sum 8, non-triple
    expect(sicBoMultiplier(small, roll)).toBeCloseTo(2.01, 2);
  });

  it("small loses on a non-triple sum outside [4, 10]", () => {
    const roll = { d1: 2, d2: 6, d3: 6 }; // sum 14
    expect(sicBoMultiplier(small, roll)).toBe(0);
  });

  it("big wins on a non-triple sum in [11, 17]", () => {
    const roll = { d1: 2, d2: 6, d3: 6 }; // sum 14, non-triple
    expect(sicBoMultiplier(big, roll)).toBeCloseTo(2.01, 2);
  });

  it("big loses on a non-triple sum outside [11, 17]", () => {
    const roll = { d1: 6, d2: 1, d3: 1 }; // sum 8
    expect(sicBoMultiplier(big, roll)).toBe(0);
  });

  it("a triple any voids a small bet even if the sum is in [4, 10]", () => {
    const roll = { d1: 3, d2: 3, d3: 3 }; // sum 9, triple
    expect(sicBoMultiplier(small, roll)).toBe(0);
  });

  it("a triple any voids a big bet even if the sum is in [11, 17]", () => {
    const roll = { d1: 4, d2: 4, d3: 4 }; // sum 12, triple
    expect(sicBoMultiplier(big, roll)).toBe(0);
  });

  it("a specific triple bet wins only on that exact triple", () => {
    const roll = { d1: 5, d2: 5, d3: 5 };
    expect(sicBoMultiplier({ kind: "triple", value: 5 }, roll)).toBeCloseTo(
      211.68,
      2,
    );
  });

  it("a specific triple bet loses on a different triple", () => {
    const roll = { d1: 5, d2: 5, d3: 5 };
    expect(sicBoMultiplier({ kind: "triple", value: 4 }, roll)).toBe(0);
  });

  it("a specific triple bet loses on a non-triple roll", () => {
    const roll = { d1: 6, d2: 1, d3: 1 };
    expect(sicBoMultiplier({ kind: "triple", value: 6 }, roll)).toBe(0);
  });

  it("triple any at the boundary sums (3 and 18) also voids small/big", () => {
    expect(sicBoMultiplier(small, { d1: 1, d2: 1, d3: 1 })).toBe(0); // sum 3
    expect(sicBoMultiplier(big, { d1: 6, d2: 6, d3: 6 })).toBe(0); // sum 18
  });
});

describe("describeSicBo", () => {
  it("renders a win line", () => {
    const roll = { d1: 6, d2: 1, d3: 1 };
    const s = describeSicBo(roll, { kind: "small" }, 2.01);
    expect(s).toContain("GANA");
    expect(s).toContain("2.01");
  });

  it("renders a loss line", () => {
    const roll = { d1: 2, d2: 6, d3: 6 };
    const s = describeSicBo(roll, { kind: "small" }, 0);
    expect(s).toContain("no gana");
  });

  it("flags a triple in the description", () => {
    const roll = { d1: 5, d2: 5, d3: 5 };
    const s = describeSicBo(roll, { kind: "triple", value: 5 }, 211.68);
    expect(s).toContain("triple");
  });
});
