import { describe, expect, it } from "vitest";
import { computePrestige } from "./prestige.js";

describe("computePrestige", () => {
  it("allows prestige at the default max level and bumps the prestige", () => {
    expect(computePrestige({ level: 100, prestige: 0 })).toEqual({
      canPrestige: true,
      nextPrestige: 1,
      title: "Novato",
    });
  });

  it("does not allow prestige below the max level", () => {
    expect(computePrestige({ level: 50, prestige: 2 })).toEqual({
      canPrestige: false,
      nextPrestige: 2,
      title: "Veterano",
    });
  });

  it("honors a custom maxLevel option", () => {
    expect(
      computePrestige({ level: 20, prestige: 5 }, { maxLevel: 20 }),
    ).toEqual({
      canPrestige: true,
      nextPrestige: 6,
      title: "Campeón",
    });
  });

  it("falls back to the default max level for an invalid maxLevel", () => {
    expect(
      computePrestige({ level: 100, prestige: 1 }, { maxLevel: 0 }),
    ).toEqual({
      canPrestige: true,
      nextPrestige: 2,
      title: "Aprendiz",
    });
  });

  it("clamps negative inputs to zero", () => {
    expect(computePrestige({ level: -5, prestige: -3 })).toEqual({
      canPrestige: false,
      nextPrestige: 0,
      title: "Novato",
    });
  });

  it("floors a fractional level that lands just below the threshold", () => {
    expect(
      computePrestige({ level: 99.9, prestige: 0 }, { maxLevel: 100 }),
    ).toEqual({
      canPrestige: false,
      nextPrestige: 0,
      title: "Novato",
    });
  });

  it("assigns the Leyenda title at the top tier", () => {
    expect(computePrestige({ level: 0, prestige: 12 })).toEqual({
      canPrestige: false,
      nextPrestige: 12,
      title: "Leyenda",
    });
  });

  it("applies tier thresholds inclusively at the boundaries", () => {
    expect(computePrestige({ level: 0, prestige: 3 }).title).toBe("Maestro");
    expect(computePrestige({ level: 0, prestige: 4 }).title).toBe("Maestro");
    expect(computePrestige({ level: 0, prestige: 10 }).title).toBe("Leyenda");
  });

  it("treats a level exactly at the max as eligible", () => {
    expect(
      computePrestige({ level: 30, prestige: 1 }, { maxLevel: 30 }),
    ).toEqual({
      canPrestige: true,
      nextPrestige: 2,
      title: "Aprendiz",
    });
  });

  it("is deterministic across repeated calls", () => {
    const input = { level: 100, prestige: 4 };
    const first = computePrestige(input, { maxLevel: 100 });
    const second = computePrestige(input, { maxLevel: 100 });
    expect(first).toEqual(second);
    expect(first).toEqual({
      canPrestige: true,
      nextPrestige: 5,
      title: "Maestro",
    });
  });
});
