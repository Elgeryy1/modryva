import { describe, expect, it } from "vitest";
import {
  DEFAULT_DUEL_RAKE,
  describeDuel,
  duelPayout,
  resolveDuel,
} from "./dice-duel.js";

describe("resolveDuel", () => {
  it("A higher → winner 1", () => {
    const res = resolveDuel(6, 2);
    expect(res.winner).toBe(1);
    expect(res.detail).toEqual({ rollA: 6, rollB: 2, winner: 1 });
  });

  it("B higher → winner 2", () => {
    const res = resolveDuel(3, 5);
    expect(res.winner).toBe(2);
    expect(res.detail).toEqual({ rollA: 3, rollB: 5, winner: 2 });
  });

  it("equal rolls → tie (winner 0)", () => {
    const res = resolveDuel(4, 4);
    expect(res.winner).toBe(0);
    expect(res.detail).toEqual({ rollA: 4, rollB: 4, winner: 0 });
  });

  it("is deterministic across repeated calls", () => {
    const a = resolveDuel(5, 1);
    const b = resolveDuel(5, 1);
    expect(a).toEqual(b);
  });

  it("covers every (A, B) pair symmetrically over 1..6", () => {
    for (let x = 1; x <= 6; x++) {
      for (let y = 1; y <= 6; y++) {
        const winner = resolveDuel(x, y).winner;
        const expected = x > y ? 1 : y > x ? 2 : 0;
        expect(winner).toBe(expected);
      }
    }
  });

  it("rejects out-of-range or non-integer rolls", () => {
    expect(() => resolveDuel(0, 3)).toThrow(RangeError);
    expect(() => resolveDuel(3, 7)).toThrow(RangeError);
    expect(() => resolveDuel(2.5, 3)).toThrow(RangeError);
  });
});

describe("duelPayout", () => {
  it("applies the default 5% rake and floors", () => {
    expect(duelPayout(200)).toBe(190);
    expect(DEFAULT_DUEL_RAKE).toBe(0.05);
  });

  it("floors fractional results (positive house edge, never over-pays)", () => {
    // 101 * 0.95 = 95.95 → floors to 95, so the house keeps 6, never 5.
    expect(duelPayout(101)).toBe(95);
  });

  it("honors a custom rake", () => {
    expect(duelPayout(100, 0.1)).toBe(90);
    expect(duelPayout(100, 0)).toBe(100);
  });

  it("is deterministic", () => {
    expect(duelPayout(200, 0.05)).toBe(duelPayout(200, 0.05));
  });

  it("rejects bad pots and rakes", () => {
    expect(() => duelPayout(-1)).toThrow(RangeError);
    expect(() => duelPayout(10.5)).toThrow(RangeError);
    expect(() => duelPayout(100, 1)).toThrow(RangeError);
    expect(() => duelPayout(100, -0.1)).toThrow(RangeError);
  });
});

describe("describeDuel", () => {
  it("names player A on winner 1", () => {
    const line = describeDuel("Ana", 6, "Beto", 2, 1);
    expect(line).toBe("🎲 Ana sacó 6 · Beto sacó 2 — ¡Gana Ana! 🏆");
  });

  it("names player B on winner 2", () => {
    const line = describeDuel("Ana", 3, "Beto", 5, 2);
    expect(line).toBe("🎲 Ana sacó 3 · Beto sacó 5 — ¡Gana Beto! 🏆");
  });

  it("announces a tie with refund note on winner 0", () => {
    const line = describeDuel("Ana", 4, "Beto", 4, 0);
    expect(line).toContain("¡Empate!");
    expect(line).toContain("Se devuelven las apuestas");
  });
});
