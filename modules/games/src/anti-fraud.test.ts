import { describe, expect, it } from "vitest";
import {
  detectCircularTransfers,
  detectFarmingPattern,
  detectImpossibleStreak,
  FARMING_MIN_GAP_MS,
  type FraudTransfer,
  IMPOSSIBLE_STREAK_MIN_MS_PER_ANSWER,
} from "./anti-fraud.js";

const SEC = 1_000;

const transfer = (from: string, to: string, amount = 100): FraudTransfer => ({
  from,
  to,
  amount,
});

describe("detectFarmingPattern", () => {
  it("returns not suspicious for fewer than 2 samples", () => {
    expect(detectFarmingPattern([])).toEqual({
      suspicious: false,
      reason: "muestras insuficientes",
    });
    expect(detectFarmingPattern([1_000]).suspicious).toBe(false);
  });

  it("flags gaps faster than the default minimum as too fast", () => {
    const result = detectFarmingPattern([0, 100, 200]);
    expect(result.suspicious).toBe(true);
    expect(result.reason).toContain("demasiado rapido");
  });

  it("respects a custom minGapMs", () => {
    // Huecos de 500ms: bajo el default (400) serian ok, pero con 600 no.
    const times = [0, 500, 1_000];
    expect(detectFarmingPattern(times).suspicious).toBe(false);
    expect(detectFarmingPattern(times, { minGapMs: 600 }).suspicious).toBe(
      true,
    );
  });

  it("flags a ritmo demasiado perfecto (near-zero jitter)", () => {
    // Huecos exactamente de 5s: CV = 0 => sospechoso por regularidad.
    const times = [0, 5 * SEC, 10 * SEC, 15 * SEC, 20 * SEC, 25 * SEC];
    const result = detectFarmingPattern(times);
    expect(result.suspicious).toBe(true);
    expect(result.reason).toContain("demasiado perfecto");
  });

  it("does not flag human-like jitter above the min gap", () => {
    const times = [0, 5_000, 11_300, 15_100, 22_800, 27_050];
    expect(detectFarmingPattern(times).suspicious).toBe(false);
  });

  it("does not flag perfect rhythm with too few samples", () => {
    // Solo 3 huecos (< FARMING_MIN_SAMPLES) aunque sean perfectamente regulares.
    const times = [0, 5 * SEC, 10 * SEC, 15 * SEC];
    expect(detectFarmingPattern(times).suspicious).toBe(false);
  });

  it("is order-independent (sorts timestamps first)", () => {
    const asc = [0, 100, 200];
    const shuffled = [200, 0, 100];
    expect(detectFarmingPattern(shuffled)).toEqual(detectFarmingPattern(asc));
  });

  it("uses FARMING_MIN_GAP_MS as the documented default", () => {
    const justUnder = [0, FARMING_MIN_GAP_MS - 1];
    const atLimit = [0, FARMING_MIN_GAP_MS];
    expect(detectFarmingPattern(justUnder).suspicious).toBe(true);
    expect(detectFarmingPattern(atLimit).suspicious).toBe(false);
  });
});

describe("detectCircularTransfers", () => {
  it("returns empty when there are no cycles", () => {
    expect(
      detectCircularTransfers([transfer("a", "b"), transfer("b", "c")]),
    ).toEqual([]);
  });

  it("detects a simple 3-node cycle in canonical order", () => {
    const cycles = detectCircularTransfers([
      transfer("b", "c"),
      transfer("c", "a"),
      transfer("a", "b"),
    ]);
    expect(cycles).toEqual([["a", "b", "c"]]);
  });

  it("detects a 2-node reciprocal cycle", () => {
    expect(
      detectCircularTransfers([transfer("x", "y"), transfer("y", "x")]),
    ).toEqual([["x", "y"]]);
  });

  it("ignores self-loops", () => {
    expect(detectCircularTransfers([transfer("a", "a")])).toEqual([]);
  });

  it("ignores transfers with non-positive amounts", () => {
    expect(
      detectCircularTransfers([transfer("a", "b", 0), transfer("b", "a", -5)]),
    ).toEqual([]);
  });

  it("reports a repeated cycle only once", () => {
    const cycles = detectCircularTransfers([
      transfer("a", "b"),
      transfer("b", "a"),
      transfer("a", "b", 50),
      transfer("b", "a", 25),
    ]);
    expect(cycles).toEqual([["a", "b"]]);
  });

  it("detects two disjoint cycles", () => {
    const cycles = detectCircularTransfers([
      transfer("a", "b"),
      transfer("b", "a"),
      transfer("m", "n"),
      transfer("n", "m"),
    ]);
    expect(cycles).toContainEqual(["a", "b"]);
    expect(cycles).toContainEqual(["m", "n"]);
    expect(cycles).toHaveLength(2);
  });

  it("is deterministic across input orderings", () => {
    const a = detectCircularTransfers([
      transfer("a", "b"),
      transfer("b", "c"),
      transfer("c", "a"),
    ]);
    const b = detectCircularTransfers([
      transfer("c", "a"),
      transfer("a", "b"),
      transfer("b", "c"),
    ]);
    expect(a).toEqual(b);
  });
});

describe("detectImpossibleStreak", () => {
  it("flags a perfect streak answered impossibly fast", () => {
    expect(detectImpossibleStreak(4, 4, [200, 300, 250, 400])).toBe(true);
  });

  it("does not flag a perfect streak with human timing", () => {
    expect(detectImpossibleStreak(4, 4, [3_000, 2_500, 4_000, 3_200])).toBe(
      false,
    );
  });

  it("does not flag when not all answers are correct", () => {
    expect(detectImpossibleStreak(3, 4, [100, 100, 100, 100])).toBe(false);
  });

  it("does not flag streaks shorter than the minimum", () => {
    expect(detectImpossibleStreak(2, 2, [10, 10])).toBe(false);
  });

  it("returns false when timing length does not match total", () => {
    expect(detectImpossibleStreak(3, 3, [100, 100])).toBe(false);
  });

  it("returns false for zero total", () => {
    expect(detectImpossibleStreak(0, 0, [])).toBe(false);
  });

  it("rejects negative timings defensively", () => {
    expect(detectImpossibleStreak(3, 3, [100, -100, 100])).toBe(false);
  });

  it("uses the average, not per-answer, against the threshold", () => {
    // Media = (100 + 100 + 2100) / 3 = 766.67 < 800 => imposible.
    expect(detectImpossibleStreak(3, 3, [100, 100, 2_100])).toBe(true);
    // Media justo en el limite no se marca (< es estricto).
    const atLimit = [
      IMPOSSIBLE_STREAK_MIN_MS_PER_ANSWER,
      IMPOSSIBLE_STREAK_MIN_MS_PER_ANSWER,
      IMPOSSIBLE_STREAK_MIN_MS_PER_ANSWER,
    ];
    expect(detectImpossibleStreak(3, 3, atLimit)).toBe(false);
  });
});
