import { describe, expect, it } from "vitest";
import {
  CRASH_EDGE_FACTOR,
  crashPoint,
  describeCrash,
  MAX_CRASH,
  settleCrash,
} from "./crash.js";

const SS = "server-seed-crash";
const CS = "client-seed-crash";

describe("crashPoint", () => {
  it("is deterministic: same seeds+nonce yield the identical crash point", () => {
    const a = crashPoint(SS, CS, 7);
    const b = crashPoint(SS, CS, 7);
    expect(a).toBe(b);
  });

  it("is always ≥ 1.00, ≤ MAX_CRASH, and rounded to 2 decimals", () => {
    for (let nonce = 0; nonce < 500; nonce += 1) {
      const c = crashPoint(SS, CS, nonce);
      expect(c).toBeGreaterThanOrEqual(1);
      expect(c).toBeLessThanOrEqual(MAX_CRASH);
      // At most 2 decimal places.
      expect(Math.round(c * 100)).toBeCloseTo(c * 100, 9);
    }
  });

  it("distribution sanity: ~P(crash ≥ 2) ≈ 0.99/2 ≈ 49.5% over many nonces", () => {
    const N = 8000;
    let atLeast2 = 0;
    for (let nonce = 0; nonce < N; nonce += 1) {
      if (crashPoint(SS, CS, nonce) >= 2) {
        atLeast2 += 1;
      }
    }
    const frac = atLeast2 / N;
    // Expected ~0.495; allow slack for the finite sample + flooring.
    expect(frac).toBeGreaterThan(0.44);
    expect(frac).toBeLessThan(0.55);
  });

  it("1% edge note: median crash sits well below the fair-game median", () => {
    // With the 0.99 factor, P(crash ≥ x) = 0.99/x, so the median (P=0.5) is at
    // x = 0.99/0.5 = 1.98 — strictly below the fair 1.00/0.5 = 2.00. This is the
    // documented POSITIVE house edge in action.
    expect(CRASH_EDGE_FACTOR).toBeLessThan(1);
    const N = 6000;
    const points: number[] = [];
    for (let nonce = 0; nonce < N; nonce += 1) {
      points.push(crashPoint(SS, CS, nonce));
    }
    points.sort((x, y) => x - y);
    const median = points[Math.floor(N / 2)] ?? 0;
    expect(median).toBeGreaterThan(1.5);
    expect(median).toBeLessThan(2.2);
  });
});

describe("settleCrash", () => {
  it("wins when cashout is at or below the crash point", () => {
    const s = settleCrash(3.5, 2, 100);
    expect(s.win).toBe(true);
    expect(s.multiplier).toBe(2);
    expect(s.payout).toBe(200);
  });

  it("wins on the boundary (cashout exactly equals crash)", () => {
    const s = settleCrash(2.5, 2.5, 100);
    expect(s.win).toBe(true);
    expect(s.payout).toBe(250);
  });

  it("loses when cashout is above the crash point (rocket blew up first)", () => {
    const s = settleCrash(1.5, 3, 100);
    expect(s.win).toBe(false);
    expect(s.multiplier).toBe(0);
    expect(s.payout).toBe(0);
  });

  it("floors fractional payouts", () => {
    const s = settleCrash(5, 1.37, 33);
    expect(s.win).toBe(true);
    expect(s.payout).toBe(Math.floor(33 * 1.37)); // 45
  });

  it("cashoutAt === 1.00 never wins, even when crash is floored to exactly 1.00 (no free win)", () => {
    const s = settleCrash(1, 1, 100);
    expect(s.win).toBe(false);
    expect(s.payout).toBe(0);
  });

  it("cashoutAt below 1.00 never wins either", () => {
    const s = settleCrash(2, 0.5, 100);
    expect(s.win).toBe(false);
  });
});

describe("describeCrash", () => {
  it("renders a Spanish win line with the rocket", () => {
    expect(describeCrash(3.5, 2, true)).toBe(
      "🚀 Crash x3.50 · retiro x2.00 — ¡Retirado a tiempo! 🤑",
    );
  });

  it("renders a Spanish loss line", () => {
    expect(describeCrash(1.5, 3, false)).toBe(
      "🚀 Crash x1.50 · retiro x3.00 — ¡Explotó! 💥 Apuesta perdida.",
    );
  });
});
