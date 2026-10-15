import { describe, expect, it } from "vitest";
import { detectRepeatedQuestions } from "./repeated-questions.js";

describe("detectRepeatedQuestions", () => {
  it("clusters normalized variants and flags a repeated pattern", () => {
    const result = detectRepeatedQuestions([
      "¿Cuándo empieza?",
      "cuando empieza",
      "CUANDO EMPIEZA!!",
      "¿Dónde es?",
    ]);
    expect(result).toEqual({
      repeated: true,
      clusters: [
        { sample: "¿Cuándo empieza?", count: 3 },
        { sample: "¿Dónde es?", count: 1 },
      ],
    });
  });

  it("sorts by count descending regardless of input order", () => {
    const result = detectRepeatedQuestions(["unique?", "dup?", "dup?", "dup?"]);
    expect(result).toEqual({
      repeated: true,
      clusters: [
        { sample: "dup?", count: 3 },
        { sample: "unique?", count: 1 },
      ],
    });
  });

  it("breaks count ties by first appearance order", () => {
    const result = detectRepeatedQuestions(["A?", "b?", "A?", "b?"], {
      minRepeats: 2,
    });
    expect(result.repeated).toBe(true);
    expect(result.clusters).toEqual([
      { sample: "A?", count: 2 },
      { sample: "b?", count: 2 },
    ]);
  });

  it("reports no repetition when all questions are distinct", () => {
    const result = detectRepeatedQuestions(["hola?", "adios?"]);
    expect(result).toEqual({
      repeated: false,
      clusters: [
        { sample: "hola?", count: 1 },
        { sample: "adios?", count: 1 },
      ],
    });
  });

  it("honors the exact minRepeats boundary", () => {
    expect(detectRepeatedQuestions(["x", "x"], { minRepeats: 2 })).toEqual({
      repeated: true,
      clusters: [{ sample: "x", count: 2 }],
    });
    expect(detectRepeatedQuestions(["x", "x"], { minRepeats: 3 })).toEqual({
      repeated: false,
      clusters: [{ sample: "x", count: 2 }],
    });
  });

  it("returns an empty result for an empty list", () => {
    expect(detectRepeatedQuestions([])).toEqual({
      repeated: false,
      clusters: [],
    });
  });

  it("skips empty, whitespace, punctuation-only and emoji questions", () => {
    expect(detectRepeatedQuestions(["", "   ", "!!!", "🎉"])).toEqual({
      repeated: false,
      clusters: [],
    });
  });

  it("merges accents, casing and punctuation and keeps the first trimmed sample", () => {
    const result = detectRepeatedQuestions([
      "  Hola Mundo  ",
      "hola mundo",
      "HÓLA MUNDO",
    ]);
    expect(result).toEqual({
      repeated: true,
      clusters: [{ sample: "Hola Mundo", count: 3 }],
    });
  });

  it("clamps minRepeats below 1 up to 1", () => {
    expect(detectRepeatedQuestions(["hola"], { minRepeats: 0 })).toEqual({
      repeated: true,
      clusters: [{ sample: "hola", count: 1 }],
    });
    expect(detectRepeatedQuestions(["hola"], { minRepeats: -5 })).toEqual({
      repeated: true,
      clusters: [{ sample: "hola", count: 1 }],
    });
  });

  it("is deterministic across repeated calls with the same input", () => {
    const input = ["¿Precio?", "precio", "precio!", "otra cosa"];
    const first = detectRepeatedQuestions(input);
    const second = detectRepeatedQuestions(input);
    expect(first).toEqual(second);
    expect(first.clusters).toEqual([
      { sample: "¿Precio?", count: 3 },
      { sample: "otra cosa", count: 1 },
    ]);
  });
});
