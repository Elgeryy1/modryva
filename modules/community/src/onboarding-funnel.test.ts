import { describe, expect, it } from "vitest";
import {
  computeOnboardingFunnel,
  type FunnelCounts,
} from "./onboarding-funnel.js";

const counts = (overrides: Partial<FunnelCounts> = {}): FunnelCounts => ({
  joined: 100,
  verified: 80,
  spoke: 40,
  returned: 20,
  ...overrides,
});

describe("computeOnboardingFunnel", () => {
  it("computes each rate against its previous stage", () => {
    const result = computeOnboardingFunnel(
      counts({ joined: 100, verified: 80, spoke: 40, returned: 20 }),
    );
    expect(result.verifyRate).toBe(0.8);
    expect(result.speakRate).toBe(0.5);
    expect(result.returnRate).toBe(0.5);
  });

  it("returns all-zero rates for an empty funnel", () => {
    const result = computeOnboardingFunnel(
      counts({ joined: 0, verified: 0, spoke: 0, returned: 0 }),
    );
    expect(result.verifyRate).toBe(0);
    expect(result.speakRate).toBe(0);
    expect(result.returnRate).toBe(0);
  });

  it("never divides by zero when only later stages are empty", () => {
    const result = computeOnboardingFunnel(
      counts({ joined: 10, verified: 0, spoke: 0, returned: 0 }),
    );
    expect(result.verifyRate).toBe(0);
    expect(result.speakRate).toBe(0);
    expect(result.returnRate).toBe(0);
  });

  it("clamps incoherent counts (stage larger than previous) to 1", () => {
    const result = computeOnboardingFunnel(
      counts({ joined: 10, verified: 50, spoke: 0, returned: 0 }),
    );
    expect(result.verifyRate).toBe(1);
  });

  it("treats negative numerators as zero", () => {
    const result = computeOnboardingFunnel(
      counts({ joined: 10, verified: -5, spoke: 0, returned: 0 }),
    );
    expect(result.verifyRate).toBe(0);
  });

  it("treats negative denominators as zero rate", () => {
    const result = computeOnboardingFunnel(
      counts({ joined: -10, verified: 5, spoke: 0, returned: 0 }),
    );
    expect(result.verifyRate).toBe(0);
  });

  it("returns 0 for non-finite inputs instead of NaN or Infinity", () => {
    const result = computeOnboardingFunnel(
      counts({
        joined: Number.NaN,
        verified: Number.POSITIVE_INFINITY,
        spoke: 10,
        returned: 5,
      }),
    );
    expect(result.verifyRate).toBe(0);
    expect(Number.isFinite(result.verifyRate)).toBe(true);
    expect(Number.isFinite(result.speakRate)).toBe(true);
  });

  it("yields a rate of 1 when a stage fully converts", () => {
    const result = computeOnboardingFunnel(
      counts({ joined: 30, verified: 30, spoke: 30, returned: 30 }),
    );
    expect(result.verifyRate).toBe(1);
    expect(result.speakRate).toBe(1);
    expect(result.returnRate).toBe(1);
  });

  it("keeps every rate within 0..1", () => {
    const inputs: FunnelCounts[] = [
      counts({ joined: 7, verified: 3, spoke: 2, returned: 1 }),
      counts({ joined: 0, verified: 5, spoke: 5, returned: 5 }),
      counts({ joined: 1000, verified: 1, spoke: 1, returned: 1 }),
    ];
    for (const input of inputs) {
      const result = computeOnboardingFunnel(input);
      for (const rate of [
        result.verifyRate,
        result.speakRate,
        result.returnRate,
      ]) {
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(1);
      }
    }
  });

  it("builds a multiline Spanish summary with the header", () => {
    const { text } = computeOnboardingFunnel(counts());
    expect(text).toContain("Embudo de onboarding");
    expect(text.split("\n")).toHaveLength(5);
  });

  it("renders rates as whole-number percentages", () => {
    const { text } = computeOnboardingFunnel(
      counts({ joined: 100, verified: 80, spoke: 40, returned: 20 }),
    );
    expect(text).toContain("Verificados: 80%");
    expect(text).toContain("Hablaron: 50%");
    expect(text).toContain("Volvieron: 50%");
  });

  it("rounds percentages to the nearest integer", () => {
    const { text } = computeOnboardingFunnel(
      counts({ joined: 3, verified: 1, spoke: 0, returned: 0 }),
    );
    // 1/3 = 0.3333 -> 33%
    expect(text).toContain("Verificados: 33%");
  });

  it("shows a truncated non-negative joined count in the text", () => {
    const { text } = computeOnboardingFunnel(
      counts({ joined: 12.9, verified: 0, spoke: 0, returned: 0 }),
    );
    expect(text).toContain("Entradas: 12");
  });

  it("shows 0 entries for negative joined count", () => {
    const { text } = computeOnboardingFunnel(
      counts({ joined: -4, verified: 0, spoke: 0, returned: 0 }),
    );
    expect(text).toContain("Entradas: 0");
  });

  it("is deterministic for identical inputs", () => {
    const input = counts({ joined: 55, verified: 40, spoke: 22, returned: 9 });
    expect(computeOnboardingFunnel(input)).toEqual(
      computeOnboardingFunnel(input),
    );
  });

  it("does not mutate the input object", () => {
    const input = counts({ joined: 10, verified: 5, spoke: 3, returned: 1 });
    const snapshot = { ...input };
    computeOnboardingFunnel(input);
    expect(input).toEqual(snapshot);
  });
});
