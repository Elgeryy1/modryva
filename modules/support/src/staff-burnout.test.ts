import { describe, expect, it } from "vitest";
import { detectBurnout } from "./staff-burnout.js";

describe("detectBurnout", () => {
  it("flags burnout at the exact rate and hours boundary", () => {
    expect(detectBurnout({ conflictsResolved: 30, hoursActive: 3 })).toEqual({
      burnout: true,
      ratePerHour: 10,
      advice:
        "⚠️ Has resuelto 30 conflictos en 3 h (10/h). Vas a un ritmo muy alto, tómate un descanso. 🌿",
    });
  });

  it("does not flag when rate is below the threshold", () => {
    expect(detectBurnout({ conflictsResolved: 10, hoursActive: 3 })).toEqual({
      burnout: false,
      ratePerHour: 3.33,
      advice:
        "✅ Ritmo de moderación saludable. Sigue así y no olvides descansar. 💧",
    });
  });

  it("does not flag when hoursActive is below minHours even at a high rate", () => {
    const result = detectBurnout({ conflictsResolved: 40, hoursActive: 2 });
    expect(result.burnout).toBe(false);
    expect(result.ratePerHour).toBe(20);
  });

  it("rounds the rate to 2 decimals", () => {
    expect(
      detectBurnout({ conflictsResolved: 100, hoursActive: 3 }).ratePerHour,
    ).toBe(33.33);
  });

  it("guards zero hoursActive and reports no burnout", () => {
    expect(detectBurnout({ conflictsResolved: 5, hoursActive: 0 })).toEqual({
      burnout: false,
      ratePerHour: 0,
      advice:
        "✅ Ritmo de moderación saludable. Sigue así y no olvides descansar. 💧",
    });
  });

  it("guards negative hoursActive as well", () => {
    const result = detectBurnout({ conflictsResolved: 5, hoursActive: -4 });
    expect(result.ratePerHour).toBe(0);
    expect(result.burnout).toBe(false);
  });

  it("reports no burnout when nothing has been resolved", () => {
    expect(detectBurnout({ conflictsResolved: 0, hoursActive: 5 })).toEqual({
      burnout: false,
      ratePerHour: 0,
      advice:
        "✅ Ritmo de moderación saludable. Sigue así y no olvides descansar. 💧",
    });
  });

  it("honours custom maxPerHour and minHours options", () => {
    const result = detectBurnout(
      { conflictsResolved: 12, hoursActive: 2 },
      { maxPerHour: 5, minHours: 2 },
    );
    expect(result).toEqual({
      burnout: true,
      ratePerHour: 6,
      advice:
        "⚠️ Has resuelto 12 conflictos en 2 h (6/h). Vas a un ritmo muy alto, tómate un descanso. 🌿",
    });
  });

  it("is deterministic across repeated calls", () => {
    const input = { conflictsResolved: 30, hoursActive: 3 } as const;
    expect(detectBurnout(input)).toEqual(detectBurnout(input));
  });
});
