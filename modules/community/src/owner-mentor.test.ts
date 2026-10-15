import { describe, expect, it } from "vitest";
import { suggestOwnerMentorTips } from "./owner-mentor.js";

const BASELINE =
  "👋 Bienvenido como owner. Empieza poco a poco y sé constante con tu comunidad.";
const RULES =
  "📜 Aún no tienes reglas. Define normas claras para marcar el tono desde el principio.";
const STAFF =
  "🛡️ No tienes staff. Recluta moderadores de confianza para no llevar toda la carga tú solo.";
const GROW =
  "🌱 Tu grupo es pequeño. Invita a personas afines y comparte contenido de valor para crecer.";
const HEALTHY =
  "🎉 Tu comunidad está bien encaminada. Mantén la actividad con eventos y dinámicas regulares.";

describe("suggestOwnerMentorTips", () => {
  it("returns baseline plus maintenance for a large, healthy group", () => {
    expect(
      suggestOwnerMentorTips({ members: 50, hasRules: true, hasStaff: true }),
    ).toEqual([BASELINE, HEALTHY]);
  });

  it("returns all four tips for a small group with nothing set up", () => {
    expect(
      suggestOwnerMentorTips({ members: 3, hasRules: false, hasStaff: false }),
    ).toEqual([BASELINE, RULES, STAFF, GROW]);
  });

  it("returns three tips for a large group missing rules and staff", () => {
    expect(
      suggestOwnerMentorTips({
        members: 100,
        hasRules: false,
        hasStaff: false,
      }),
    ).toEqual([BASELINE, RULES, STAFF]);
  });

  it("returns baseline plus growth for a small, healthy group", () => {
    expect(
      suggestOwnerMentorTips({ members: 5, hasRules: true, hasStaff: true }),
    ).toEqual([BASELINE, GROW]);
  });

  it("treats the small-group threshold as exclusive (members 9 is small)", () => {
    expect(
      suggestOwnerMentorTips({ members: 9, hasRules: true, hasStaff: true }),
    ).toEqual([BASELINE, GROW]);
  });

  it("treats members equal to the threshold as established (members 10)", () => {
    expect(
      suggestOwnerMentorTips({ members: 10, hasRules: true, hasStaff: true }),
    ).toEqual([BASELINE, HEALTHY]);
  });

  it("omits the healthy tip when a large group lacks staff", () => {
    const tips = suggestOwnerMentorTips({
      members: 40,
      hasRules: true,
      hasStaff: false,
    });
    expect(tips).toEqual([BASELINE, STAFF]);
    expect(tips).not.toContain(HEALTHY);
  });

  it("omits the rules tip when only staff is missing", () => {
    expect(
      suggestOwnerMentorTips({ members: 20, hasRules: true, hasStaff: false }),
    ).toEqual([BASELINE, STAFF]);
  });

  it("always returns between 2 and 4 tips", () => {
    const states = [
      { members: 0, hasRules: false, hasStaff: false },
      { members: 0, hasRules: true, hasStaff: true },
      { members: 500, hasRules: true, hasStaff: true },
      { members: 500, hasRules: false, hasStaff: true },
    ] as const;
    for (const state of states) {
      const tips = suggestOwnerMentorTips(state);
      expect(tips.length).toBeGreaterThanOrEqual(2);
      expect(tips.length).toBeLessThanOrEqual(4);
    }
  });

  it("is deterministic across repeated calls", () => {
    const state = { members: 7, hasRules: false, hasStaff: true } as const;
    expect(suggestOwnerMentorTips(state)).toEqual(
      suggestOwnerMentorTips(state),
    );
  });
});
