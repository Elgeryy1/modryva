import { describe, expect, it } from "vitest";
import { computeDynamicCooldownMs } from "./dynamic-cooldown.js";

describe("computeDynamicCooldownMs", () => {
  it("returns baseMs for abuseScore 0", () => {
    expect(computeDynamicCooldownMs({ abuseScore: 0 })).toBe(5000);
  });

  it("doubles the cooldown for each abuse step", () => {
    expect(computeDynamicCooldownMs({ abuseScore: 1 })).toBe(10000);
    expect(computeDynamicCooldownMs({ abuseScore: 3 })).toBe(40000);
  });

  it("caps the cooldown at the default maxMs", () => {
    // 5000 * 2^6 = 320000, clamped to 300000
    expect(computeDynamicCooldownMs({ abuseScore: 6 })).toBe(300000);
  });

  it("clamps abuseScore above 6 down to the exponent ceiling", () => {
    expect(computeDynamicCooldownMs({ abuseScore: 100 })).toBe(300000);
  });

  it("clamps negative abuseScore to 0", () => {
    expect(computeDynamicCooldownMs({ abuseScore: -12 })).toBe(5000);
  });

  it("floors fractional abuseScore before scaling", () => {
    // floor(2.9) = 2 -> 5000 * 4 = 20000
    expect(computeDynamicCooldownMs({ abuseScore: 2.9 })).toBe(20000);
  });

  it("honors custom baseMs and maxMs", () => {
    // 1000 * 2^4 = 16000, under the 50000 ceiling
    expect(
      computeDynamicCooldownMs(
        { abuseScore: 4 },
        { baseMs: 1000, maxMs: 50000 },
      ),
    ).toBe(16000);
  });

  it("applies the custom ceiling when exceeded", () => {
    // 1000 * 2^6 = 64000, clamped to 50000
    expect(
      computeDynamicCooldownMs(
        { abuseScore: 6 },
        { baseMs: 1000, maxMs: 50000 },
      ),
    ).toBe(50000);
  });

  it("falls back to defaults for non-finite options", () => {
    expect(
      computeDynamicCooldownMs({ abuseScore: 1 }, { baseMs: Number.NaN }),
    ).toBe(10000);
    expect(computeDynamicCooldownMs({ abuseScore: 6 }, { maxMs: -1 })).toBe(
      300000,
    );
  });

  it("treats a non-finite abuseScore as 0", () => {
    expect(computeDynamicCooldownMs({ abuseScore: Number.NaN })).toBe(5000);
    expect(
      computeDynamicCooldownMs({ abuseScore: Number.POSITIVE_INFINITY }),
    ).toBe(5000);
  });

  it("is monotonically non-decreasing across the abuse range", () => {
    const series = [0, 1, 2, 3, 4, 5, 6].map((abuseScore) =>
      computeDynamicCooldownMs({ abuseScore }),
    );
    expect(series).toEqual([5000, 10000, 20000, 40000, 80000, 160000, 300000]);
    for (let i = 1; i < series.length; i += 1) {
      const prev = series[i - 1] ?? 0;
      const curr = series[i] ?? 0;
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });
});
