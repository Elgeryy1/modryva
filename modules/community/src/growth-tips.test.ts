import { describe, expect, it } from "vitest";
import { suggestGrowthTips } from "./growth-tips.js";

const TIP_DRAMA =
  "⚖️ Hay demasiados conflictos esta semana. Publica reglas claras y usa avisos antes de expulsar para reducir el drama.";
const TIP_RAPID =
  "🚀 Estás creciendo muy rápido. Da la bienvenida a cada nuevo miembro y refuerza la moderación para evitar spam.";
const TIP_STAGNANT =
  "🌱 El crecimiento está estancado. Comparte contenido de valor e invita a miembros afines para crecer de forma responsable.";
const TIP_SMALL =
  "🤝 Tu comunidad es pequeña todavía. Concéntrate en conversaciones de calidad y en construir confianza antes de escalar.";
const G1 =
  "📌 Mantén fijado un mensaje con las normas para que todos las conozcan.";
const G2 =
  "💬 Fomenta conversaciones respetuosas y agradece a quienes ayudan a los demás.";

describe("suggestGrowthTips", () => {
  it("returns two general tips for a healthy, balanced community", () => {
    expect(
      suggestGrowthTips({ members: 1000, weeklyConflicts: 2, weeklyJoins: 50 }),
    ).toEqual([G1, G2]);
  });

  it("flags high conflict with the drama tip first", () => {
    const tips = suggestGrowthTips({
      members: 100,
      weeklyConflicts: 10,
      weeklyJoins: 5,
    });
    expect(tips[0]).toBe(TIP_DRAMA);
    expect(tips).toContain(TIP_DRAMA);
    expect(tips).toHaveLength(2);
  });

  it("flags rapid growth with the onboarding tip", () => {
    const tips = suggestGrowthTips({
      members: 100,
      weeklyConflicts: 0,
      weeklyJoins: 30,
    });
    expect(tips[0]).toBe(TIP_RAPID);
  });

  it("flags stagnation when there are no new joins", () => {
    const tips = suggestGrowthTips({
      members: 500,
      weeklyConflicts: 1,
      weeklyJoins: 0,
    });
    expect(tips[0]).toBe(TIP_STAGNANT);
  });

  it("flags a small community with the foundational tip", () => {
    const tips = suggestGrowthTips({
      members: 10,
      weeklyConflicts: 0,
      weeklyJoins: 1,
    });
    expect(tips[0]).toBe(TIP_SMALL);
  });

  it("combines multiple signals in fixed priority order", () => {
    expect(
      suggestGrowthTips({ members: 40, weeklyConflicts: 5, weeklyJoins: 20 }),
    ).toEqual([TIP_DRAMA, TIP_RAPID, TIP_SMALL]);
  });

  it("handles the empty community edge case", () => {
    expect(
      suggestGrowthTips({ members: 0, weeklyConflicts: 0, weeklyJoins: 0 }),
    ).toEqual([TIP_STAGNANT, TIP_SMALL]);
  });

  it("always returns between 2 and 4 tips", () => {
    const states = [
      { members: 0, weeklyConflicts: 0, weeklyJoins: 0 },
      { members: 5000, weeklyConflicts: 0, weeklyJoins: 200 },
      { members: 40, weeklyConflicts: 5, weeklyJoins: 20 },
      { members: 100, weeklyConflicts: 10, weeklyJoins: 5 },
    ];
    for (const state of states) {
      const tips = suggestGrowthTips(state);
      expect(tips.length).toBeGreaterThanOrEqual(2);
      expect(tips.length).toBeLessThanOrEqual(4);
    }
  });

  it("is deterministic for repeated calls with the same state", () => {
    const state = { members: 40, weeklyConflicts: 5, weeklyJoins: 20 };
    expect(suggestGrowthTips(state)).toEqual(suggestGrowthTips(state));
  });
});
