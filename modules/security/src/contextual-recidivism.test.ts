import { describe, expect, it } from "vitest";
import { detectContextualRecidivism } from "./contextual-recidivism.js";

describe("detectContextualRecidivism", () => {
  it("flags recidivism across a different context", () => {
    expect(
      detectContextualRecidivism([{ context: "Grupo A", kind: "spam" }], {
        kind: "spam",
      }),
    ).toEqual({ recidivist: true, priorContexts: ["Grupo A"] });
  });

  it("collects distinct contexts in first-appearance order", () => {
    expect(
      detectContextualRecidivism(
        [
          { context: "Grupo A", kind: "spam" },
          { context: "Grupo B", kind: "spam" },
          { context: "Grupo A", kind: "spam" },
        ],
        { kind: "spam" },
      ),
    ).toEqual({ recidivist: true, priorContexts: ["Grupo A", "Grupo B"] });
  });

  it("ignores history events of a different kind", () => {
    expect(
      detectContextualRecidivism(
        [
          { context: "Grupo A", kind: "flood" },
          { context: "Grupo B", kind: "enlaces" },
        ],
        { kind: "spam" },
      ),
    ).toEqual({ recidivist: false, priorContexts: [] });
  });

  it("mixes matching and non-matching kinds", () => {
    expect(
      detectContextualRecidivism(
        [
          { context: "Grupo A", kind: "spam" },
          { context: "Grupo B", kind: "flood" },
          { context: "Grupo C", kind: "spam" },
        ],
        { kind: "spam" },
      ),
    ).toEqual({ recidivist: true, priorContexts: ["Grupo A", "Grupo C"] });
  });

  it("returns non-recidivist for empty history", () => {
    expect(detectContextualRecidivism([], { kind: "spam" })).toEqual({
      recidivist: false,
      priorContexts: [],
    });
  });

  it("deduplicates the same context repeated for the same kind", () => {
    expect(
      detectContextualRecidivism(
        [
          { context: "Grupo A", kind: "spam" },
          { context: "Grupo A", kind: "spam" },
          { context: "Grupo A", kind: "spam" },
        ],
        { kind: "spam" },
      ),
    ).toEqual({ recidivist: true, priorContexts: ["Grupo A"] });
  });

  it("treats kind matching case-sensitively", () => {
    expect(
      detectContextualRecidivism([{ context: "Grupo A", kind: "Spam" }], {
        kind: "spam",
      }),
    ).toEqual({ recidivist: false, priorContexts: [] });
  });

  it("distinguishes contexts that share a kind but differ by name", () => {
    expect(
      detectContextualRecidivism(
        [
          { context: "Anuncios", kind: "enlaces" },
          { context: "General", kind: "enlaces" },
        ],
        { kind: "enlaces" },
      ),
    ).toEqual({ recidivist: true, priorContexts: ["Anuncios", "General"] });
  });

  it("is deterministic across repeated calls", () => {
    const history: readonly {
      readonly context: string;
      readonly kind: string;
    }[] = [
      { context: "Grupo B", kind: "flood" },
      { context: "Grupo A", kind: "flood" },
      { context: "Grupo B", kind: "flood" },
    ];
    const first = detectContextualRecidivism(history, { kind: "flood" });
    const second = detectContextualRecidivism(history, { kind: "flood" });
    expect(first).toEqual(second);
    expect(first).toEqual({
      recidivist: true,
      priorContexts: ["Grupo B", "Grupo A"],
    });
  });
});
