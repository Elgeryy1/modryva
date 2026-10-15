import { describe, expect, it } from "vitest";
import {
  applyDecay,
  applyWhaleTax,
  ECONOMY_DEFAULT_HALF_LIFE_MS,
  ECONOMY_DEFAULT_WHALE_TOP_PCT,
  earnPoints,
  seasonReset,
  type Wallet,
} from "./economy.js";

const wallet = (overrides: Partial<Wallet> = {}): Wallet => ({
  balance: 1000,
  lastEarnedMs: 0,
  ...overrides,
});

const DAY = 24 * 60 * 60 * 1000;

describe("applyDecay", () => {
  it("halves the balance after exactly one half-life", () => {
    const result = applyDecay(wallet({ balance: 1000 }), DAY, DAY);
    expect(result.balance).toBe(500);
  });

  it("never advances lastEarnedMs (decay is not activity)", () => {
    const result = applyDecay(
      wallet({ balance: 1000, lastEarnedMs: 5 }),
      5 + DAY,
      DAY,
    );
    expect(result.lastEarnedMs).toBe(5);
  });

  it("returns the wallet intact when now is at or before lastEarnedMs", () => {
    const w = wallet({ balance: 800, lastEarnedMs: 100 });
    expect(applyDecay(w, 100, DAY)).toEqual(w);
    expect(applyDecay(w, 50, DAY)).toEqual(w);
  });

  it("returns the wallet intact for a zero or negative half-life", () => {
    const w = wallet({ balance: 800, lastEarnedMs: 0 });
    expect(applyDecay(w, DAY, 0)).toEqual(w);
    expect(applyDecay(w, DAY, -5)).toEqual(w);
  });

  it("leaves an already-empty balance at zero", () => {
    const w = wallet({ balance: 0, lastEarnedMs: 0 });
    expect(applyDecay(w, 10 * DAY, DAY)).toEqual(w);
  });

  it("is idempotent for the same clock reading and matches the default half-life", () => {
    const w = wallet({ balance: 1000, lastEarnedMs: 10 });
    const once = applyDecay(
      w,
      10 + ECONOMY_DEFAULT_HALF_LIFE_MS,
      ECONOMY_DEFAULT_HALF_LIFE_MS,
    );
    const twice = applyDecay(
      w,
      10 + ECONOMY_DEFAULT_HALF_LIFE_MS,
      ECONOMY_DEFAULT_HALF_LIFE_MS,
    );
    expect(once).toEqual(twice);
    expect(once.balance).toBe(500);
  });
});

describe("applyWhaleTax", () => {
  it("returns an empty array for empty input", () => {
    expect(applyWhaleTax([])).toEqual([]);
  });

  it("pulls the top whale halfway toward the mean and leaves the rest", () => {
    // mean = 140/5 = 28; only the 100 is a whale -> (100 + 28) / 2 = 64
    expect(applyWhaleTax([100, 10, 10, 10, 10])).toEqual([64, 10, 10, 10, 10]);
  });

  it("preserves the original order", () => {
    expect(applyWhaleTax([10, 100, 10, 10, 10])).toEqual([10, 64, 10, 10, 10]);
  });

  it("does not change a perfectly equal distribution", () => {
    expect(applyWhaleTax([50, 50, 50, 50])).toEqual([50, 50, 50, 50]);
  });

  it("recorta varias ballenas cuando topPct es mayor", () => {
    // mean = 220/4 = 55; topPct 0.5 -> whaleCount = 2, threshold = 100
    // 100 -> (100+55)/2 = 77.5 -> 78 ; el otro 100 igual ; 10 y 10 sin cambio
    expect(applyWhaleTax([100, 100, 10, 10], 0.5)).toEqual([78, 78, 10, 10]);
  });

  it("falls back to the default top pct for out-of-range values", () => {
    const balances = [100, 10, 10, 10, 10];
    expect(applyWhaleTax(balances, 0)).toEqual(applyWhaleTax(balances));
    expect(applyWhaleTax(balances, 5)).toEqual(applyWhaleTax(balances));
    expect(applyWhaleTax(balances, Number.NaN)).toEqual(
      applyWhaleTax(balances),
    );
  });

  it("sanitizes negative and non-finite balances to zero", () => {
    expect(applyWhaleTax([-50, 20, 20], 0.5)).toEqual([0, 20, 20]);
  });

  it("is deterministic for identical inputs", () => {
    const balances = [90, 30, 15, 5, 200];
    expect(applyWhaleTax(balances)).toEqual(applyWhaleTax(balances));
  });

  it("uses the exported default top pct constant", () => {
    expect(ECONOMY_DEFAULT_WHALE_TOP_PCT).toBe(0.1);
  });
});

describe("earnPoints", () => {
  it("grants the full amount when under the daily cap", () => {
    const result = earnPoints(wallet({ balance: 100 }), 40, 500, 100, 0);
    expect(result).toEqual({
      wallet: { balance: 140, lastEarnedMs: 500 },
      granted: 40,
    });
  });

  it("clamps the grant to the remaining daily cap", () => {
    const result = earnPoints(wallet({ balance: 100 }), 40, 500, 100, 80);
    expect(result.granted).toBe(20);
    expect(result.wallet.balance).toBe(120);
    expect(result.wallet.lastEarnedMs).toBe(500);
  });

  it("grants nothing and keeps the wallet intact when the cap is exhausted", () => {
    const w = wallet({ balance: 100, lastEarnedMs: 10 });
    const result = earnPoints(w, 40, 500, 100, 100);
    expect(result.granted).toBe(0);
    expect(result.wallet).toEqual(w);
  });

  it("grants nothing for a non-positive requested amount", () => {
    const w = wallet({ balance: 100, lastEarnedMs: 10 });
    expect(earnPoints(w, 0, 500, 100, 0).granted).toBe(0);
    expect(earnPoints(w, -5, 500, 100, 0).wallet).toEqual(w);
  });

  it("grants nothing when the daily cap is zero", () => {
    const w = wallet({ balance: 100, lastEarnedMs: 10 });
    const result = earnPoints(w, 40, 500, 0, 0);
    expect(result).toEqual({ wallet: w, granted: 0 });
  });

  it("advances lastEarnedMs only when it actually grants", () => {
    const granted = earnPoints(wallet({ lastEarnedMs: 1 }), 10, 999, 100, 0);
    expect(granted.wallet.lastEarnedMs).toBe(999);
    const denied = earnPoints(wallet({ lastEarnedMs: 1 }), 10, 999, 100, 100);
    expect(denied.wallet.lastEarnedMs).toBe(1);
  });
});

describe("seasonReset", () => {
  it("keeps the given percentage of the balance", () => {
    expect(seasonReset(wallet({ balance: 1000 }), 0.2).balance).toBe(200);
  });

  it("empties the balance for keepPct <= 0", () => {
    expect(seasonReset(wallet({ balance: 1000 }), 0).balance).toBe(0);
    expect(seasonReset(wallet({ balance: 1000 }), -1).balance).toBe(0);
  });

  it("keeps the whole balance for keepPct >= 1", () => {
    expect(seasonReset(wallet({ balance: 1000 }), 1).balance).toBe(1000);
    expect(seasonReset(wallet({ balance: 1000 }), 5).balance).toBe(1000);
  });

  it("preserves lastEarnedMs (reset is not activity)", () => {
    expect(
      seasonReset(wallet({ balance: 1000, lastEarnedMs: 42 }), 0.5),
    ).toEqual({
      balance: 500,
      lastEarnedMs: 42,
    });
  });
});
