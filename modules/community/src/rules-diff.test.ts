import { describe, expect, it } from "vitest";
import { diffRules } from "./rules-diff.js";

describe("diffRules", () => {
  it("detects a single added rule preserving current order", () => {
    expect(
      diffRules(
        ["No spam", "Respeta a todos"],
        ["No spam", "Respeta a todos", "No enlaces"],
      ),
    ).toEqual({
      added: ["No enlaces"],
      removed: [],
      unchangedCount: 2,
      summary: "Cambió 1 cosa: 1 añadida. 📝",
    });
  });

  it("reports added and removed together with correct plurals", () => {
    expect(diffRules(["A", "B", "C"], ["A", "D"])).toEqual({
      added: ["D"],
      removed: ["B", "C"],
      unchangedCount: 1,
      summary: "Cambiaron 3 cosas: 1 añadida, 2 eliminadas. 📝",
    });
  });

  it("uses singular forms for one added and one removed", () => {
    expect(diffRules(["A"], ["B"])).toEqual({
      added: ["B"],
      removed: ["A"],
      unchangedCount: 0,
      summary: "Cambiaron 2 cosas: 1 añadida, 1 eliminada. 📝",
    });
  });

  it("says nothing changed when lists match", () => {
    expect(diffRules(["A", "B"], ["A", "B"])).toEqual({
      added: [],
      removed: [],
      unchangedCount: 2,
      summary: "No hubo cambios en las normas.",
    });
  });

  it("treats trimming as equality so whitespace-only differences are unchanged", () => {
    expect(diffRules(["  No spam  "], ["No spam"])).toEqual({
      added: [],
      removed: [],
      unchangedCount: 1,
      summary: "No hubo cambios en las normas.",
    });
  });

  it("ignores empty and whitespace-only rules", () => {
    expect(diffRules(["A", "  ", ""], ["A"])).toEqual({
      added: [],
      removed: [],
      unchangedCount: 1,
      summary: "No hubo cambios en las normas.",
    });
  });

  it("deduplicates repeated rules before comparing", () => {
    expect(diffRules(["A", "A", "B"], ["A"])).toEqual({
      added: [],
      removed: ["B"],
      unchangedCount: 1,
      summary: "Cambió 1 cosa: 1 eliminada. 📝",
    });
  });

  it("handles two empty lists", () => {
    expect(diffRules([], [])).toEqual({
      added: [],
      removed: [],
      unchangedCount: 0,
      summary: "No hubo cambios en las normas.",
    });
  });

  it("reports everything as added when previous is empty, keeping order", () => {
    expect(diffRules([], ["Z", "A", "M"])).toEqual({
      added: ["Z", "A", "M"],
      removed: [],
      unchangedCount: 0,
      summary: "Cambiaron 3 cosas: 3 añadidas. 📝",
    });
  });

  it("reports everything as removed when current is empty", () => {
    expect(diffRules(["A", "B"], [])).toEqual({
      added: [],
      removed: ["A", "B"],
      unchangedCount: 0,
      summary: "Cambiaron 2 cosas: 2 eliminadas. 📝",
    });
  });

  it("is deterministic across repeated calls", () => {
    const previous = ["A", "B", "C"];
    const current = ["B", "C", "D", "E"];
    const first = diffRules(previous, current);
    const second = diffRules(previous, current);
    expect(first).toEqual(second);
    expect(first).toEqual({
      added: ["D", "E"],
      removed: ["A"],
      unchangedCount: 2,
      summary: "Cambiaron 3 cosas: 2 añadidas, 1 eliminada. 📝",
    });
  });

  it("does not mutate its input arrays", () => {
    const previous = ["A", "B"];
    const current = ["B", "C"];
    diffRules(previous, current);
    expect(previous).toEqual(["A", "B"]);
    expect(current).toEqual(["B", "C"]);
  });
});
