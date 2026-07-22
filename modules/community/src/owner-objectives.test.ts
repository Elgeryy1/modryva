import { describe, expect, it } from "vitest";
import {
  formatObjectives,
  type ObjectiveProgress,
  OWNER_OBJECTIVES,
  objectiveLabel,
  objectivePercent,
} from "./owner-objectives.js";

const progress = (
  objective: string,
  current: number,
  target: number,
): ObjectiveProgress => ({ objective, current, target });

describe("OWNER_OBJECTIVES", () => {
  it("lists the five canonical objectives in order", () => {
    expect(OWNER_OBJECTIVES).toEqual([
      "crecer",
      "limpiar-spam",
      "monetizar",
      "retener",
      "soporte",
    ]);
  });

  it("has no duplicate slugs", () => {
    expect(new Set(OWNER_OBJECTIVES).size).toBe(OWNER_OBJECTIVES.length);
  });
});

describe("objectiveLabel", () => {
  it("maps known slugs to accented labels", () => {
    expect(objectiveLabel("monetizar")).toBe("Monetización");
    expect(objectiveLabel("retener")).toBe("Retención");
    expect(objectiveLabel("limpiar-spam")).toBe("Limpiar el spam");
  });

  it("returns unknown slugs verbatim", () => {
    expect(objectiveLabel("otro-objetivo")).toBe("otro-objetivo");
  });
});

describe("objectivePercent", () => {
  it("computes a rounded percentage for normal input", () => {
    expect(objectivePercent(progress("crecer", 30, 100))).toBe(30);
    expect(objectivePercent(progress("crecer", 1, 3))).toBe(33);
    expect(objectivePercent(progress("crecer", 2, 3))).toBe(67);
  });

  it("returns 0 when target is 0 (no division by zero)", () => {
    expect(objectivePercent(progress("crecer", 5, 0))).toBe(0);
  });

  it("returns 0 when target is negative", () => {
    expect(objectivePercent(progress("crecer", 5, -10))).toBe(0);
  });

  it("clamps to 100 when current exceeds target", () => {
    expect(objectivePercent(progress("crecer", 150, 100))).toBe(100);
  });

  it("clamps to 0 when current is negative", () => {
    expect(objectivePercent(progress("crecer", -5, 100))).toBe(0);
  });

  it("returns 0 when current is exactly 0", () => {
    expect(objectivePercent(progress("crecer", 0, 100))).toBe(0);
  });

  it("returns 100 when current equals target", () => {
    expect(objectivePercent(progress("crecer", 100, 100))).toBe(100);
  });

  it("returns 0 for non-finite inputs", () => {
    expect(objectivePercent(progress("crecer", Number.NaN, 100))).toBe(0);
    expect(
      objectivePercent(progress("crecer", 5, Number.POSITIVE_INFINITY)),
    ).toBe(0);
  });

  it("is deterministic for identical inputs", () => {
    const p = progress("retener", 7, 9);
    expect(objectivePercent(p)).toBe(objectivePercent(p));
  });
});

describe("formatObjectives", () => {
  it("returns a placeholder when there are no objectives", () => {
    expect(formatObjectives([])).toBe("🎯 Aún no hay objetivos configurados.");
  });

  it("renders a header and one line per objective", () => {
    const out = formatObjectives([
      progress("crecer", 30, 100),
      progress("soporte", 100, 100),
    ]);
    expect(out).toBe(
      [
        "🎯 Objetivos del propietario:",
        "• Crecer la comunidad: ███░░░░░░░ 30%",
        "• Soporte: ██████████ 100%",
      ].join("\n"),
    );
  });

  it("uses accented labels for known slugs", () => {
    const out = formatObjectives([progress("monetizar", 0, 100)]);
    expect(out).toContain("Monetización");
    expect(out).toContain("░░░░░░░░░░ 0%");
  });

  it("renders unknown slugs verbatim", () => {
    const out = formatObjectives([progress("mi-meta", 5, 10)]);
    expect(out).toContain("• mi-meta: █████░░░░░ 50%");
  });

  it("shows 0% for zero-target objectives without crashing", () => {
    const out = formatObjectives([progress("crecer", 5, 0)]);
    expect(out).toContain("0%");
  });

  it("is deterministic for identical inputs", () => {
    const items = [progress("crecer", 1, 4), progress("retener", 3, 4)];
    expect(formatObjectives(items)).toBe(formatObjectives(items));
  });
});
