import { describe, expect, it } from "vitest";
import { buildShiftSummary } from "./shift-summary.js";

describe("buildShiftSummary", () => {
  it("tallies events and sorts breakdown by count desc", () => {
    const result = buildShiftSummary([
      { kind: "ban" },
      { kind: "warn" },
      { kind: "ban" },
      { kind: "mute" },
      { kind: "warn" },
      { kind: "ban" },
    ]);
    expect(result.total).toBe(6);
    expect(result.byKind).toEqual([
      { kind: "ban", count: 3 },
      { kind: "warn", count: 2 },
      { kind: "mute", count: 1 },
    ]);
    expect(result.text).toBe(
      "Resumen de guardia: 6 eventos en el turno (ban ×3, warn ×2, mute ×1). 📋",
    );
  });

  it("breaks count ties by kind ascending", () => {
    const result = buildShiftSummary([{ kind: "b" }, { kind: "a" }]);
    expect(result.byKind).toEqual([
      { kind: "a", count: 1 },
      { kind: "b", count: 1 },
    ]);
  });

  it("returns a friendly no-activity line for empty input", () => {
    const result = buildShiftSummary([]);
    expect(result).toEqual({
      total: 0,
      byKind: [],
      text: "Resumen de guardia: sin actividad en el turno. 😴",
    });
  });

  it("uses the singular noun for a single event", () => {
    const result = buildShiftSummary([{ kind: "ban" }]);
    expect(result.total).toBe(1);
    expect(result.text).toBe(
      "Resumen de guardia: 1 evento en el turno (ban ×1). 📋",
    );
  });

  it("uses the plural noun for two events of the same kind", () => {
    const result = buildShiftSummary([{ kind: "ban" }, { kind: "ban" }]);
    expect(result.text).toBe(
      "Resumen de guardia: 2 eventos en el turno (ban ×2). 📋",
    );
  });

  it("handles a single distinct kind occurring many times", () => {
    const result = buildShiftSummary([
      { kind: "spam" },
      { kind: "spam" },
      { kind: "spam" },
    ]);
    expect(result.byKind).toEqual([{ kind: "spam", count: 3 }]);
    expect(result.total).toBe(3);
  });

  it("produces a deterministic order regardless of input order", () => {
    const first = buildShiftSummary([
      { kind: "warn" },
      { kind: "ban" },
      { kind: "ban" },
    ]);
    const second = buildShiftSummary([
      { kind: "ban" },
      { kind: "warn" },
      { kind: "ban" },
    ]);
    expect(first.byKind).toEqual(second.byKind);
    expect(first.byKind).toEqual([
      { kind: "ban", count: 2 },
      { kind: "warn", count: 1 },
    ]);
  });

  it("keeps distinct kinds with equal counts fully alphabetized", () => {
    const result = buildShiftSummary([
      { kind: "delta" },
      { kind: "alpha" },
      { kind: "charlie" },
      { kind: "bravo" },
    ]);
    expect(result.byKind.map((entry) => entry.kind)).toEqual([
      "alpha",
      "bravo",
      "charlie",
      "delta",
    ]);
  });

  it("includes an empty-string kind as a valid tally", () => {
    const result = buildShiftSummary([{ kind: "" }, { kind: "ban" }]);
    expect(result.total).toBe(2);
    expect(result.byKind).toEqual([
      { kind: "", count: 1 },
      { kind: "ban", count: 1 },
    ]);
  });
});
