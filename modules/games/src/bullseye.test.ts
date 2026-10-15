import { describe, expect, it } from "vitest";
import {
  BULLSEYE_HOUSE_EDGE,
  BULLSEYE_WAYS,
  bullseyeMultiplier,
  type DartTier,
  describeBullseye,
  isBullseyeValue,
  landedTier,
  resolveBullseye,
} from "./bullseye.js";

const TIERS: readonly DartTier[] = ["fuera", "aro", "diana"];

describe("isBullseyeValue", () => {
  it("accepts integers 1..6", () => {
    for (let v = 1; v <= 6; v++) {
      expect(isBullseyeValue(v)).toBe(true);
    }
  });

  it("rejects out-of-range and non-integers", () => {
    expect(isBullseyeValue(0)).toBe(false);
    expect(isBullseyeValue(7)).toBe(false);
    expect(isBullseyeValue(3.5)).toBe(false);
    expect(isBullseyeValue(Number.NaN)).toBe(false);
  });
});

describe("landedTier boundaries", () => {
  it("maps 1-3 to fuera, 4-5 to aro, 6 to diana", () => {
    expect(landedTier(1)).toBe("fuera");
    expect(landedTier(3)).toBe("fuera");
    expect(landedTier(4)).toBe("aro");
    expect(landedTier(5)).toBe("aro");
    expect(landedTier(6)).toBe("diana");
  });
});

describe("bullseyeMultiplier", () => {
  it("prices each tier as (6/ways)*(1-edge), rounded to 2 decimals", () => {
    expect(bullseyeMultiplier("fuera")).toBe(1.9);
    expect(bullseyeMultiplier("aro")).toBe(2.85);
    expect(bullseyeMultiplier("diana")).toBe(5.7);
  });

  it("keeps a flat 5% house edge across tiers", () => {
    for (const tier of TIERS) {
      const ways = BULLSEYE_WAYS[tier];
      const ev = (ways / 6) * bullseyeMultiplier(tier);
      // EV per unit staked ≈ 0.95 → 5% edge (allow rounding slack).
      expect(Math.abs(ev - (1 - BULLSEYE_HOUSE_EDGE))).toBeLessThan(0.01);
    }
  });
});

describe("resolveBullseye win logic", () => {
  it("wins when the chosen tier matches where the dart landed", () => {
    const r = resolveBullseye(6, "diana");
    expect(r.detail.win).toBe(true);
    expect(r.detail.landed).toBe("diana");
    expect(r.multiplier).toBe(5.7);
  });

  it("loses when the dart lands in a different tier", () => {
    const r = resolveBullseye(6, "fuera");
    expect(r.detail.win).toBe(false);
    expect(r.detail.landed).toBe("diana");
    expect(r.multiplier).toBe(0);
  });

  it("covers every value × tier combination consistently", () => {
    for (let v = 1; v <= 6; v++) {
      const landed = landedTier(v);
      for (const tier of TIERS) {
        const { multiplier, detail } = resolveBullseye(v, tier);
        expect(detail.value).toBe(v);
        expect(detail.tier).toBe(tier);
        expect(detail.landed).toBe(landed);
        expect(detail.win).toBe(landed === tier);
        expect(multiplier).toBe(landed === tier ? bullseyeMultiplier(tier) : 0);
      }
    }
  });
});

describe("determinism", () => {
  it("returns identical results for identical inputs", () => {
    const a = resolveBullseye(4, "aro");
    const b = resolveBullseye(4, "aro");
    expect(a).toEqual(b);
  });
});

describe("describeBullseye", () => {
  it("renders a single winning line with emoji and multiplier", () => {
    const { detail } = resolveBullseye(6, "diana");
    const line = describeBullseye(detail);
    expect(line).toContain("🎯");
    expect(line).toContain("×5.7");
    expect(line).toContain("¡Diana!");
    expect(line.split("\n")).toHaveLength(1);
  });

  it("renders a losing line noting where it fell", () => {
    const { detail } = resolveBullseye(1, "diana");
    const line = describeBullseye(detail);
    expect(line).toContain("🎯");
    expect(line).toContain("Fuera");
    expect(line).toContain("pierdes");
  });
});
