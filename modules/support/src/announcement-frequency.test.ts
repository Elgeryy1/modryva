import { describe, expect, it } from "vitest";
import { checkAnnouncementFrequency } from "./announcement-frequency.js";

describe("checkAnnouncementFrequency", () => {
  it("flags too many announcements inside the default 24h window", () => {
    const now = 100_000_000;
    const result = checkAnnouncementFrequency(
      [20_000_000, 50_000_000, 90_000_000, 99_000_000],
      now,
    );
    expect(result).toEqual({
      tooMany: true,
      countInWindow: 4,
      advice:
        "⚠️ Llevas 4 anuncios recientes y el límite es 3. Espera un poco antes de publicar otro para no saturar el grupo. 🙏",
    });
  });

  it("returns the no-announcements advice for an empty array", () => {
    const result = checkAnnouncementFrequency([], 100_000_000);
    expect(result).toEqual({
      tooMany: false,
      countInWindow: 0,
      advice: "✅ No hay anuncios recientes. Puedes publicar con tranquilidad.",
    });
  });

  it("excludes timestamps older than the window start", () => {
    const now = 100_000_000;
    // windowStart = 100_000_000 - 86_400_000 = 13_600_000
    const result = checkAnnouncementFrequency(
      [1_000_000, 5_000_000, 13_599_999],
      now,
    );
    expect(result.countInWindow).toBe(0);
    expect(result.tooMany).toBe(false);
    expect(result.advice).toBe(
      "✅ No hay anuncios recientes. Puedes publicar con tranquilidad.",
    );
  });

  it("excludes timestamps in the future (after nowMs)", () => {
    const now = 100_000_000;
    const result = checkAnnouncementFrequency([100_000_001, 200_000_000], now);
    expect(result.countInWindow).toBe(0);
    expect(result.tooMany).toBe(false);
  });

  it("counts boundary timestamps inclusively at window start and now", () => {
    const now = 86_400_000; // windowStart = 0 with default 24h window
    const result = checkAnnouncementFrequency(
      [-1, 0, 86_400_000, 86_400_001],
      now,
    );
    expect(result).toEqual({
      tooMany: false,
      countInWindow: 2,
      advice:
        "✅ Vas 2 de 3 anuncios recientes. Aún tienes margen, pero espacia las publicaciones.",
    });
  });

  it("uses the at-limit advice when the count equals the max", () => {
    const now = 100_000_000;
    const result = checkAnnouncementFrequency(
      [20_000_000, 50_000_000, 90_000_000],
      now,
    );
    expect(result).toEqual({
      tooMany: false,
      countInWindow: 3,
      advice:
        "📢 Vas 3 de 3 anuncios. Has llegado al límite recomendado; si puedes, agrupa lo siguiente en un solo mensaje.",
    });
  });

  it("uses the below-limit advice when the count is under the max", () => {
    const now = 100_000_000;
    const result = checkAnnouncementFrequency([20_000_000, 90_000_000], now);
    expect(result).toEqual({
      tooMany: false,
      countInWindow: 2,
      advice:
        "✅ Vas 2 de 3 anuncios recientes. Aún tienes margen, pero espacia las publicaciones.",
    });
  });

  it("respects custom windowMs and maxInWindow options", () => {
    const now = 10_000_000;
    // windowMs 1h -> windowStart = 10_000_000 - 3_600_000 = 6_400_000
    const result = checkAnnouncementFrequency(
      [6_500_000, 9_000_000, 1_000_000],
      now,
      {
        windowMs: 3_600_000,
        maxInWindow: 1,
      },
    );
    expect(result).toEqual({
      tooMany: true,
      countInWindow: 2,
      advice:
        "⚠️ Llevas 2 anuncios recientes y el límite es 1. Espera un poco antes de publicar otro para no saturar el grupo. 🙏",
    });
  });

  it("warns on any announcement when maxInWindow is 0", () => {
    const now = 100_000_000;
    const result = checkAnnouncementFrequency([90_000_000], now, {
      maxInWindow: 0,
    });
    expect(result).toEqual({
      tooMany: true,
      countInWindow: 1,
      advice:
        "⚠️ Llevas 1 anuncios recientes y el límite es 0. Espera un poco antes de publicar otro para no saturar el grupo. 🙏",
    });
  });

  it("clamps negative options to safe defaults instead of warning", () => {
    const now = 100_000_000;
    // negative maxInWindow clamped to 0, negative window clamped to 0 -> only now counts
    const result = checkAnnouncementFrequency([90_000_000], now, {
      windowMs: -5_000,
      maxInWindow: -3,
    });
    expect(result.countInWindow).toBe(0);
    expect(result.tooMany).toBe(false);
    expect(result.advice).toBe(
      "✅ No hay anuncios recientes. Puedes publicar con tranquilidad.",
    );
  });

  it("is order-independent (deterministic) for the same timestamps", () => {
    const now = 100_000_000;
    const ascending = checkAnnouncementFrequency(
      [20_000_000, 50_000_000, 90_000_000, 99_000_000],
      now,
    );
    const shuffled = checkAnnouncementFrequency(
      [99_000_000, 20_000_000, 90_000_000, 50_000_000],
      now,
    );
    expect(shuffled).toEqual(ascending);
  });
});
