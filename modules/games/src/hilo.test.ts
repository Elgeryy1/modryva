import { describe, expect, it } from "vitest";
import { CASINO } from "./casino.js";
import {
  dealHiLo,
  describeHiLo,
  type HiLoBet,
  type HiLoDeal,
  hiLoMultiplier,
} from "./hilo.js";

const SS = "server-seed-abc";
const CS = "client-seed-xyz";

describe("dealHiLo", () => {
  it("returns current and next both in [1, 13]", () => {
    for (let nonce = 0; nonce < 500; nonce += 1) {
      const { current, next } = dealHiLo(SS, CS, nonce);
      expect(Number.isInteger(current)).toBe(true);
      expect(Number.isInteger(next)).toBe(true);
      expect(current).toBeGreaterThanOrEqual(1);
      expect(current).toBeLessThanOrEqual(13);
      expect(next).toBeGreaterThanOrEqual(1);
      expect(next).toBeLessThanOrEqual(13);
    }
  });

  it("is deterministic for the same (serverSeed, clientSeed, nonce)", () => {
    for (let nonce = 0; nonce < 20; nonce += 1) {
      expect(dealHiLo(SS, CS, nonce)).toEqual(dealHiLo(SS, CS, nonce));
    }
  });

  it("current and next can differ across the nonce space (not always a tie)", () => {
    let sawDiff = false;
    for (let nonce = 0; nonce < 200; nonce += 1) {
      const { current, next } = dealHiLo(SS, CS, nonce);
      if (current !== next) {
        sawDiff = true;
        break;
      }
    }
    expect(sawDiff).toBe(true);
  });
});

describe("hiLoMultiplier — fixed current, concrete win/loss cases", () => {
  it("current=1: higher wins for every next in 2..13", () => {
    for (let next = 2; next <= 13; next += 1) {
      const deal: HiLoDeal = { current: 1, next };
      expect(hiLoMultiplier({ kind: "higher" }, deal)).toBeGreaterThan(0);
    }
  });

  it("current=1: higher loses only on a tie (next=1)", () => {
    const deal: HiLoDeal = { current: 1, next: 1 };
    expect(hiLoMultiplier({ kind: "higher" }, deal)).toBe(0);
  });

  it("current=1: lower is impossible for every next (multiplier 0)", () => {
    for (let next = 1; next <= 13; next += 1) {
      const deal: HiLoDeal = { current: 1, next };
      expect(hiLoMultiplier({ kind: "lower" }, deal)).toBe(0);
    }
  });
});

describe("hiLoMultiplier — tie always loses for both bets", () => {
  it("next === current loses for higher and lower, across all ranks", () => {
    for (let current = 1; current <= 13; current += 1) {
      const deal: HiLoDeal = { current, next: current };
      expect(hiLoMultiplier({ kind: "higher" }, deal)).toBe(0);
      expect(hiLoMultiplier({ kind: "lower" }, deal)).toBe(0);
    }
  });
});

describe("hiLoMultiplier — extreme case current=13", () => {
  it("higher is impossible for every next (no division by zero, multiplier 0)", () => {
    for (let next = 1; next <= 13; next += 1) {
      const deal: HiLoDeal = { current: 13, next };
      expect(() => hiLoMultiplier({ kind: "higher" }, deal)).not.toThrow();
      expect(hiLoMultiplier({ kind: "higher" }, deal)).toBe(0);
    }
  });

  it("lower wins for every next in 1..12", () => {
    for (let next = 1; next <= 12; next += 1) {
      const deal: HiLoDeal = { current: 13, next };
      expect(hiLoMultiplier({ kind: "lower" }, deal)).toBeGreaterThan(0);
    }
  });
});

describe("hiLoMultiplier — formula matches manual calculation", () => {
  const cases: Array<{ current: number; bet: HiLoBet["kind"] }> = [
    { current: 7, bet: "higher" },
    { current: 7, bet: "lower" },
    { current: 4, bet: "higher" },
    { current: 10, bet: "lower" },
    { current: 2, bet: "lower" },
  ];

  for (const { current, bet } of cases) {
    it(`current=${current}, bet=${bet}`, () => {
      const favorableCount = bet === "higher" ? 13 - current : current - 1;
      const winChance = favorableCount / 13;
      const expected = Math.floor((1 / winChance) * (1 - CASINO.houseEdge));
      // Pick a `next` that actually wins this bet to exercise the win path.
      const next = bet === "higher" ? 13 : 1;
      const deal: HiLoDeal = { current, next };
      expect(hiLoMultiplier({ kind: bet }, deal)).toBe(expected);
    });
  }

  it("current=7 higher/lower both have 6/13 win chance", () => {
    const higher = hiLoMultiplier({ kind: "higher" }, { current: 7, next: 13 });
    const lower = hiLoMultiplier({ kind: "lower" }, { current: 7, next: 1 });
    expect(higher).toBe(lower);
    expect(higher).toBe(Math.floor((13 / 6) * (1 - CASINO.houseEdge)));
  });
});

describe("hiLoMultiplier — determinism", () => {
  it("same bet + deal always yields the same multiplier", () => {
    const deal: HiLoDeal = { current: 5, next: 9 };
    const a = hiLoMultiplier({ kind: "higher" }, deal);
    const b = hiLoMultiplier({ kind: "higher" }, deal);
    expect(a).toBe(b);
  });
});

describe("describeHiLo", () => {
  it("renders a win with the multiplier and rank labels", () => {
    const deal: HiLoDeal = { current: 1, next: 13 };
    const mult = hiLoMultiplier({ kind: "higher" }, deal);
    const s = describeHiLo(deal, { kind: "higher" }, mult);
    expect(s).toContain("A");
    expect(s).toContain("K");
    expect(s).toContain("GANA");
  });

  it("renders a loss on a tie", () => {
    const deal: HiLoDeal = { current: 7, next: 7 };
    const s = describeHiLo(deal, { kind: "higher" }, 0);
    expect(s).toContain("no gana");
  });
});
