import { describe, expect, it } from "vitest";
import { evaluateStreakAchievements } from "./streak-achievements.js";

describe("evaluateStreakAchievements", () => {
  it("unlocks the first milestone exactly at 3 days", () => {
    expect(evaluateStreakAchievements(3)).toEqual([
      {
        id: "racha_constante",
        title: "🌱 Racha constante: 3 días participando sano",
      },
    ]);
  });

  it("unlocks the first two milestones at 7 days in curated order", () => {
    expect(evaluateStreakAchievements(7)).toEqual([
      {
        id: "racha_constante",
        title: "🌱 Racha constante: 3 días participando sano",
      },
      {
        id: "semana_saludable",
        title: "⭐ Semana saludable: 7 días ayudando y sin romper normas",
      },
    ]);
  });

  it("unlocks all three milestones at 30 days", () => {
    expect(evaluateStreakAchievements(30)).toEqual([
      {
        id: "racha_constante",
        title: "🌱 Racha constante: 3 días participando sano",
      },
      {
        id: "semana_saludable",
        title: "⭐ Semana saludable: 7 días ayudando y sin romper normas",
      },
      {
        id: "leyenda_comunitaria",
        title: "🏆 Leyenda comunitaria: 30 días de racha ejemplar",
      },
    ]);
  });

  it("keeps all three unlocked well beyond the top milestone", () => {
    const ids = evaluateStreakAchievements(100).map((a) => a.id);
    expect(ids).toEqual([
      "racha_constante",
      "semana_saludable",
      "leyenda_comunitaria",
    ]);
  });

  it("returns empty just below the first threshold", () => {
    expect(evaluateStreakAchievements(2)).toEqual([]);
  });

  it("returns empty for a zero-day streak", () => {
    expect(evaluateStreakAchievements(0)).toEqual([]);
  });

  it("returns empty for a negative streak", () => {
    expect(evaluateStreakAchievements(-5)).toEqual([]);
  });

  it("returns empty for NaN", () => {
    expect(evaluateStreakAchievements(Number.NaN)).toEqual([]);
  });

  it("returns empty for Infinity guard when not finite", () => {
    expect(evaluateStreakAchievements(Number.POSITIVE_INFINITY)).toEqual([]);
  });

  it("counts fractional days toward the reached threshold", () => {
    const ids = evaluateStreakAchievements(7.9).map((a) => a.id);
    expect(ids).toEqual(["racha_constante", "semana_saludable"]);
  });

  it("is deterministic across repeated calls", () => {
    expect(evaluateStreakAchievements(30)).toEqual(
      evaluateStreakAchievements(30),
    );
  });

  it("respects boundary just below the top milestone", () => {
    const ids = evaluateStreakAchievements(29).map((a) => a.id);
    expect(ids).toEqual(["racha_constante", "semana_saludable"]);
  });
});
