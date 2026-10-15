import { describe, expect, it } from "vitest";
import { buildBanChecklist } from "./ban-checklist.js";

describe("buildBanChecklist", () => {
  it("marks ready when every check is done", () => {
    const result = buildBanChecklist({
      hasEvidence: true,
      isRepeatOffender: true,
      ruleCited: true,
      durationSet: true,
    });
    expect(result.ready).toBe(true);
    expect(result.pendingCount).toBe(0);
    expect(result.items).toEqual([
      { label: "Evidencia adjunta", done: true },
      { label: "Reincidencia verificada", done: true },
      { label: "Regla violada citada", done: true },
      { label: "Duración definida", done: true },
    ]);
  });

  it("is not ready when every check is missing", () => {
    const result = buildBanChecklist({
      hasEvidence: false,
      isRepeatOffender: false,
      ruleCited: false,
      durationSet: false,
    });
    expect(result.ready).toBe(false);
    expect(result.pendingCount).toBe(4);
    expect(result.items.every((item) => !item.done)).toBe(true);
  });

  it("maps each flag to its own item", () => {
    const result = buildBanChecklist({
      hasEvidence: true,
      isRepeatOffender: false,
      ruleCited: true,
      durationSet: false,
    });
    expect(result.items.map((item) => item.done)).toEqual([
      true,
      false,
      true,
      false,
    ]);
    expect(result.ready).toBe(false);
    expect(result.pendingCount).toBe(2);
  });

  it("is not ready when a single check is missing", () => {
    const result = buildBanChecklist({
      hasEvidence: true,
      isRepeatOffender: true,
      ruleCited: true,
      durationSet: false,
    });
    expect(result.ready).toBe(false);
    expect(result.pendingCount).toBe(1);
  });

  it("keeps the item order fixed regardless of flags", () => {
    const labelsA = buildBanChecklist({
      hasEvidence: false,
      isRepeatOffender: true,
      ruleCited: false,
      durationSet: true,
    }).items.map((item) => item.label);
    const labelsB = buildBanChecklist({
      hasEvidence: true,
      isRepeatOffender: false,
      ruleCited: true,
      durationSet: false,
    }).items.map((item) => item.label);
    expect(labelsA).toEqual([
      "Evidencia adjunta",
      "Reincidencia verificada",
      "Regla violada citada",
      "Duración definida",
    ]);
    expect(labelsB).toEqual(labelsA);
  });

  it("always returns exactly four items", () => {
    const result = buildBanChecklist({
      hasEvidence: true,
      isRepeatOffender: true,
      ruleCited: false,
      durationSet: true,
    });
    expect(result.items).toHaveLength(4);
  });

  it("uses accented Spanish for the duration label", () => {
    const result = buildBanChecklist({
      hasEvidence: false,
      isRepeatOffender: false,
      ruleCited: false,
      durationSet: true,
    });
    const duration = result.items[3];
    expect(duration).toEqual({ label: "Duración definida", done: true });
  });

  it("is deterministic for identical inputs", () => {
    const input = {
      hasEvidence: true,
      isRepeatOffender: false,
      ruleCited: false,
      durationSet: true,
    } as const;
    expect(buildBanChecklist(input)).toEqual(buildBanChecklist(input));
  });
});
