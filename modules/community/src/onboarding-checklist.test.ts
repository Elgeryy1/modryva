import { describe, expect, it } from "vitest";
import { buildFirstStepsChecklist } from "./onboarding-checklist.js";

describe("buildFirstStepsChecklist", () => {
  it("marks complete when all three steps are done", () => {
    expect(
      buildFirstStepsChecklist({
        readRules: true,
        introduced: true,
        pickedInterests: true,
      }),
    ).toEqual({
      complete: true,
      items: [
        { label: "Lee las reglas del grupo 📜", done: true },
        { label: "Preséntate a la comunidad 👋", done: true },
        { label: "Elige tus intereses ✨", done: true },
      ],
    });
  });

  it("marks incomplete when nothing is done", () => {
    expect(
      buildFirstStepsChecklist({
        readRules: false,
        introduced: false,
        pickedInterests: false,
      }),
    ).toEqual({
      complete: false,
      items: [
        { label: "Lee las reglas del grupo 📜", done: false },
        { label: "Preséntate a la comunidad 👋", done: false },
        { label: "Elige tus intereses ✨", done: false },
      ],
    });
  });

  it("is incomplete when only rules are read", () => {
    const result = buildFirstStepsChecklist({
      readRules: true,
      introduced: false,
      pickedInterests: false,
    });
    expect(result.complete).toBe(false);
    expect(result.items.map((item) => item.done)).toEqual([true, false, false]);
  });

  it("is incomplete when only the introduction is missing", () => {
    const result = buildFirstStepsChecklist({
      readRules: true,
      introduced: false,
      pickedInterests: true,
    });
    expect(result.complete).toBe(false);
    expect(result.items.map((item) => item.done)).toEqual([true, false, true]);
  });

  it("is incomplete when only interests are missing", () => {
    const result = buildFirstStepsChecklist({
      readRules: true,
      introduced: true,
      pickedInterests: false,
    });
    expect(result.complete).toBe(false);
    expect(result.items[2]?.done).toBe(false);
  });

  it("always returns exactly three steps in a fixed order", () => {
    const result = buildFirstStepsChecklist({
      readRules: false,
      introduced: true,
      pickedInterests: false,
    });
    expect(result.items).toHaveLength(3);
    expect(result.items.map((item) => item.label)).toEqual([
      "Lee las reglas del grupo 📜",
      "Preséntate a la comunidad 👋",
      "Elige tus intereses ✨",
    ]);
  });

  it("uses accented Spanish labels", () => {
    const result = buildFirstStepsChecklist({
      readRules: false,
      introduced: false,
      pickedInterests: false,
    });
    expect(result.items[1]?.label).toContain("Preséntate");
  });

  it("is deterministic for identical inputs", () => {
    const state = { readRules: true, introduced: false, pickedInterests: true };
    expect(buildFirstStepsChecklist(state)).toEqual(
      buildFirstStepsChecklist(state),
    );
  });

  it("maps each flag to its matching step done value", () => {
    const result = buildFirstStepsChecklist({
      readRules: false,
      introduced: true,
      pickedInterests: true,
    });
    expect(result.items.map((item) => item.done)).toEqual([false, true, true]);
    expect(result.complete).toBe(false);
  });
});
