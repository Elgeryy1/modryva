import { describe, expect, it } from "vitest";
import {
  DEFAULT_HOUSE_EDGE,
  describeMines,
  isMine,
  MINES_TILES,
  minesLayout,
  minesMultiplier,
} from "./mines.js";

const SS = "server-seed-abc";
const CS = "client-seed-xyz";

describe("minesLayout", () => {
  it("returns exactly mineCount unique tiles in 0..24, sorted", () => {
    for (const mineCount of [1, 3, 5, 12, 24]) {
      const layout = minesLayout(SS, CS, 1, mineCount);
      expect(layout).toHaveLength(mineCount);
      // unique
      expect(new Set(layout).size).toBe(mineCount);
      // in range
      for (const tile of layout) {
        expect(tile).toBeGreaterThanOrEqual(0);
        expect(tile).toBeLessThan(MINES_TILES);
        expect(Number.isInteger(tile)).toBe(true);
      }
      // sorted ascending
      const sorted = [...layout].sort((a, b) => a - b);
      expect(layout).toEqual(sorted);
    }
  });

  it("is deterministic for identical inputs and varies with nonce", () => {
    expect(minesLayout(SS, CS, 7, 5)).toEqual(minesLayout(SS, CS, 7, 5));
    // Different nonce should (very likely) give a different layout.
    expect(minesLayout(SS, CS, 7, 5)).not.toEqual(minesLayout(SS, CS, 8, 5));
  });

  it("clamps out-of-range mine counts to a playable [1,24]", () => {
    expect(minesLayout(SS, CS, 1, 0)).toHaveLength(1);
    expect(minesLayout(SS, CS, 1, -4)).toHaveLength(1);
    expect(minesLayout(SS, CS, 1, 99)).toHaveLength(MINES_TILES - 1);
  });
});

describe("minesMultiplier", () => {
  it("rises strictly with each additional reveal", () => {
    const mineCount = 3;
    const safe = MINES_TILES - mineCount;
    let prev = -1;
    for (let revealed = 0; revealed <= safe; revealed += 1) {
      const m = minesMultiplier(mineCount, revealed);
      expect(m).toBeGreaterThan(prev);
      prev = m;
    }
  });

  it("rises with mineCount at a fixed reveal count", () => {
    const revealed = 3;
    let prev = -1;
    for (const mineCount of [1, 2, 5, 10, 20]) {
      const m = minesMultiplier(mineCount, revealed);
      expect(m).toBeGreaterThan(prev);
      prev = m;
    }
  });

  it("returns (1 - houseEdge) with zero reveals", () => {
    expect(minesMultiplier(5, 0)).toBeCloseTo(1 - DEFAULT_HOUSE_EDGE, 10);
    expect(minesMultiplier(5, 0, 0)).toBe(1);
  });

  it("applies a positive ~3% house edge vs the fair multiplier", () => {
    const mineCount = 3;
    const revealed = 4;
    const fairOnly = minesMultiplier(mineCount, revealed, 0);
    const withEdge = minesMultiplier(mineCount, revealed);
    // withEdge should be strictly less than fair (positive edge).
    expect(withEdge).toBeLessThan(fairOnly);
    // Edge is ~3% (allow slack for 2-decimal truncation of both multipliers).
    const ratio = withEdge / fairOnly;
    expect(ratio).toBeGreaterThan(0.95);
    expect(ratio).toBeLessThan(0.99);
  });

  it("matches the closed-form fair product for a known case", () => {
    // mineCount=1 -> safe=24. After 1 reveal: 25/24. With 3% edge, truncated.
    const fair = 25 / 24;
    const expected = Math.floor(fair * (1 - 0.03) * 100) / 100;
    expect(minesMultiplier(1, 1)).toBe(expected);
  });

  it("has 2-decimal precision (truncated)", () => {
    const m = minesMultiplier(5, 6);
    expect(Number((m * 100).toFixed(6)) % 1).toBe(0);
  });

  it("clamps revealed beyond available safe tiles", () => {
    const mineCount = 20; // safe = 5
    const atMax = minesMultiplier(mineCount, 5);
    expect(minesMultiplier(mineCount, 99)).toBe(atMax);
    expect(minesMultiplier(mineCount, -3)).toBe(1 - DEFAULT_HOUSE_EDGE);
  });
});

describe("isMine", () => {
  it("reports mine membership from a layout", () => {
    const layout = minesLayout(SS, CS, 42, 5);
    const first = layout[0] ?? 0;
    expect(isMine(layout, first)).toBe(true);
    const safe = [...Array(MINES_TILES).keys()].find(
      (t) => !layout.includes(t),
    );
    expect(safe).toBeDefined();
    expect(isMine(layout, safe as number)).toBe(false);
  });
});

describe("describeMines", () => {
  it("describes an in-play round with current cashout", () => {
    const s = describeMines(3, 4, false, false);
    expect(s).toContain("In play");
    expect(s).toContain("x");
  });

  it("describes a mine hit as a loss", () => {
    const s = describeMines(3, 4, false, true);
    expect(s.toLowerCase()).toContain("boom");
    expect(s).toContain("0x");
  });

  it("describes a cashout with the multiplier", () => {
    const s = describeMines(3, 4, true, false);
    expect(s).toContain("Cashed out");
    expect(s).toContain(minesMultiplier(3, 4).toFixed(2));
  });

  it("describes clearing the whole board", () => {
    const mineCount = 20; // safe = 5
    const s = describeMines(mineCount, 5, false, false);
    expect(s).toContain("Cleared the board");
  });

  it("returns a plain string (JSON-serializable)", () => {
    const s = describeMines(5, 2, false, false);
    expect(typeof s).toBe("string");
    expect(JSON.parse(JSON.stringify({ s })).s).toBe(s);
  });
});
