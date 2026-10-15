import { describe, expect, it } from "vitest";
import { classifyGroupSize, recommendBySize } from "./size-recommendations.js";

describe("classifyGroupSize", () => {
  it("classifies a handful of members as micro", () => {
    expect(classifyGroupSize(10)).toBe("micro");
  });

  it("picks the right tier at each boundary", () => {
    expect(classifyGroupSize(29)).toBe("micro");
    expect(classifyGroupSize(30)).toBe("pequeno");
    expect(classifyGroupSize(299)).toBe("pequeno");
    expect(classifyGroupSize(300)).toBe("mediano");
    expect(classifyGroupSize(2999)).toBe("mediano");
    expect(classifyGroupSize(3000)).toBe("grande");
    expect(classifyGroupSize(19999)).toBe("grande");
    expect(classifyGroupSize(20000)).toBe("masivo");
  });

  it("treats zero members as micro", () => {
    expect(classifyGroupSize(0)).toBe("micro");
  });

  it("clamps negative counts to micro", () => {
    expect(classifyGroupSize(-500)).toBe("micro");
  });

  it("treats NaN as micro", () => {
    expect(classifyGroupSize(Number.NaN)).toBe("micro");
  });

  it("routes very large groups to masivo", () => {
    expect(classifyGroupSize(1_000_000)).toBe("masivo");
  });
});

describe("recommendBySize", () => {
  it("returns the exact micro recommendations", () => {
    expect(recommendBySize(5)).toEqual({
      tier: "micro",
      recommendations: [
        "Salúdalos a mano: con tan pocos miembros, el trato cercano funciona mejor. 👋",
        "Deja el antispam en modo suave: aquí el ruido es mínimo.",
        "Evita el CAPTCHA de entrada: añade fricción y no hace falta a esta escala.",
      ],
    });
  });

  it("gives between two and four tips for every tier", () => {
    const samples = [10, 100, 1000, 10000, 50000];
    for (const count of samples) {
      const { recommendations } = recommendBySize(count);
      expect(recommendations.length).toBeGreaterThanOrEqual(2);
      expect(recommendations.length).toBeLessThanOrEqual(4);
    }
  });

  it("returns non-empty string tips for every tier", () => {
    const samples = [10, 100, 1000, 10000, 50000];
    for (const count of samples) {
      const { recommendations } = recommendBySize(count);
      for (const tip of recommendations) {
        expect(typeof tip).toBe("string");
        expect(tip.length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the tier consistent with classifyGroupSize", () => {
    const samples = [0, 29, 30, 300, 3000, 20000];
    for (const count of samples) {
      expect(recommendBySize(count).tier).toBe(classifyGroupSize(count));
    }
  });

  it("is deterministic for repeated calls", () => {
    expect(recommendBySize(750)).toEqual(recommendBySize(750));
    expect(recommendBySize(30000)).toEqual(recommendBySize(30000));
  });
});
