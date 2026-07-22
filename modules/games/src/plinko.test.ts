import { describe, expect, it } from "vitest";
import {
  describePlinko,
  PLINKO_PAYOUTS,
  type PlinkoRisk,
  type PlinkoRows,
  resolvePlinko,
} from "./plinko.js";

const SERVER = "a".repeat(64);
const CLIENT = "player-seed";
const RISKS: PlinkoRisk[] = ["bajo", "medio", "alto"];
const ROWS: PlinkoRows[] = [8, 12, 16];

// Binomial(n, 1/2) probabilities for the slot distribution.
const binomialProbs = (n: number): number[] => {
  const coeff: number[] = [1];
  for (let k = 0; k < n; k += 1) {
    coeff.push((coeff[k] as number) * ((n - k) / (k + 1)));
  }
  const total = 2 ** n;
  return coeff.map((c) => c / total);
};

describe("PLINKO_PAYOUTS tables", () => {
  it("has the right length, is symmetric, and edges >= center", () => {
    for (const risk of RISKS) {
      for (const rows of ROWS) {
        const table = PLINKO_PAYOUTS[risk][rows];
        expect(table).toHaveLength(rows + 1);
        for (let i = 0; i < table.length; i += 1) {
          expect(table[i]).toBe(table[table.length - 1 - i]);
        }
        const center = table[Math.floor(rows / 2)] as number;
        expect((table[0] as number) >= center).toBe(true);
      }
    }
  });

  it("keeps a positive house edge in the ~3-5% band", () => {
    for (const risk of RISKS) {
      for (const rows of ROWS) {
        const probs = binomialProbs(rows);
        const table = PLINKO_PAYOUTS[risk][rows];
        let ev = 0;
        for (let s = 0; s <= rows; s += 1) {
          ev += (probs[s] as number) * (table[s] as number);
        }
        const edge = 1 - ev;
        expect(edge).toBeGreaterThan(0.02);
        expect(edge).toBeLessThan(0.06);
      }
    }
  });
});

describe("resolvePlinko", () => {
  it("path length === rows and slot in [0, rows]", () => {
    for (const risk of RISKS) {
      for (const rows of ROWS) {
        for (let nonce = 0; nonce < 40; nonce += 1) {
          const { detail } = resolvePlinko(SERVER, CLIENT, nonce, rows, risk);
          expect(detail.path).toHaveLength(rows);
          expect(detail.slot).toBeGreaterThanOrEqual(0);
          expect(detail.slot).toBeLessThanOrEqual(rows);
        }
      }
    }
  });

  it("slot equals the number of R bounces in the path", () => {
    for (const rows of ROWS) {
      const { detail } = resolvePlinko(SERVER, CLIENT, 7, rows, "medio");
      const rCount = detail.path.filter((step) => step === "R").length;
      expect(detail.slot).toBe(rCount);
    }
  });

  it("multiplier matches the payout table for the resolved slot", () => {
    for (const risk of RISKS) {
      for (const rows of ROWS) {
        for (let nonce = 0; nonce < 25; nonce += 1) {
          const { multiplier, detail } = resolvePlinko(
            SERVER,
            CLIENT,
            nonce,
            rows,
            risk,
          );
          expect(multiplier).toBe(PLINKO_PAYOUTS[risk][rows][detail.slot]);
        }
      }
    }
  });

  it("is deterministic for the same seeds/nonce/rows/risk", () => {
    const a = resolvePlinko(SERVER, CLIENT, 3, 12, "alto");
    const b = resolvePlinko(SERVER, CLIENT, 3, 12, "alto");
    expect(b).toEqual(a);
  });

  it("changes with the nonce", () => {
    const outcomes = new Set<string>();
    for (let nonce = 0; nonce < 30; nonce += 1) {
      const { detail } = resolvePlinko(SERVER, CLIENT, nonce, 16, "bajo");
      outcomes.add(detail.path.join(""));
    }
    expect(outcomes.size).toBeGreaterThan(1);
  });

  it("throws on unsupported row counts", () => {
    expect(() => resolvePlinko(SERVER, CLIENT, 0, 10, "bajo")).toThrow();
  });

  it("returns JSON-serializable detail", () => {
    const { detail } = resolvePlinko(SERVER, CLIENT, 1, 8, "medio");
    expect(JSON.parse(JSON.stringify(detail))).toEqual(detail);
  });
});

describe("describePlinko", () => {
  it("mentions rows, slot, path and multiplier", () => {
    const { multiplier, detail } = resolvePlinko(SERVER, CLIENT, 2, 8, "bajo");
    const text = describePlinko(detail, multiplier);
    expect(text).toContain("8");
    expect(text).toContain(String(detail.slot));
    expect(text).toContain(detail.path.join(""));
    expect(text).toContain(`${multiplier}×`);
  });
});
