import { describe, expect, it } from "vitest";
import { detectCircularArgument } from "./circular-argument.js";

describe("detectCircularArgument", () => {
  it("flags two authors each repeating themselves (happy path)", () => {
    const messages = [
      { authorId: 1, text: "No estoy de acuerdo" },
      { authorId: 2, text: "Pues yo si" },
      { authorId: 1, text: "no estoy de acuerdo!" },
      { authorId: 2, text: "Pues yo si." },
    ];
    expect(detectCircularArgument(messages)).toEqual({
      circular: true,
      authors: [1, 2],
      repeats: 2,
    });
  });

  it("treats case, accents and punctuation as near-duplicates", () => {
    const messages = [
      { authorId: 7, text: "¡Basta!" },
      { authorId: 4, text: "No" },
      { authorId: 7, text: "basta" },
      { authorId: 4, text: "no." },
    ];
    expect(detectCircularArgument(messages)).toEqual({
      circular: true,
      authors: [4, 7],
      repeats: 2,
    });
  });

  it("is not circular when only one author repeats", () => {
    const messages = [
      { authorId: 1, text: "hola" },
      { authorId: 2, text: "adios" },
      { authorId: 1, text: "hola" },
    ];
    expect(detectCircularArgument(messages)).toEqual({
      circular: false,
      authors: [],
      repeats: 1,
    });
  });

  it("returns authors sorted ascending regardless of speaking order", () => {
    const messages = [
      { authorId: 9, text: "basta ya" },
      { authorId: 3, text: "tu empezaste" },
      { authorId: 9, text: "Basta ya" },
      { authorId: 3, text: "Tu empezaste" },
    ];
    expect(detectCircularArgument(messages)).toEqual({
      circular: true,
      authors: [3, 9],
      repeats: 2,
    });
  });

  it("respects a custom minRepeats threshold in both directions", () => {
    const messages = [
      { authorId: 1, text: "si" },
      { authorId: 2, text: "no" },
      { authorId: 1, text: "si" },
      { authorId: 2, text: "no" },
      { authorId: 1, text: "si" },
      { authorId: 2, text: "no" },
    ];
    expect(detectCircularArgument(messages, { minRepeats: 3 })).toEqual({
      circular: true,
      authors: [1, 2],
      repeats: 3,
    });
    expect(detectCircularArgument(messages, { minRepeats: 4 })).toEqual({
      circular: false,
      authors: [],
      repeats: 3,
    });
  });

  it("ignores punctuation-only messages that normalize to empty", () => {
    const messages = [
      { authorId: 1, text: "esto es importante" },
      { authorId: 2, text: "..." },
      { authorId: 1, text: "esto es importante" },
      { authorId: 2, text: "???" },
    ];
    expect(detectCircularArgument(messages)).toEqual({
      circular: false,
      authors: [],
      repeats: 0,
    });
  });

  it("is not circular with three or more distinct authors", () => {
    const messages = [
      { authorId: 1, text: "a" },
      { authorId: 2, text: "a" },
      { authorId: 3, text: "a" },
      { authorId: 1, text: "a" },
      { authorId: 2, text: "a" },
      { authorId: 3, text: "a" },
    ];
    expect(detectCircularArgument(messages)).toEqual({
      circular: false,
      authors: [],
      repeats: 0,
    });
  });

  it("is not circular when a single author keeps insisting", () => {
    const messages = [
      { authorId: 5, text: "insisto" },
      { authorId: 5, text: "insisto" },
      { authorId: 5, text: "insisto" },
    ];
    expect(detectCircularArgument(messages)).toEqual({
      circular: false,
      authors: [],
      repeats: 0,
    });
  });

  it("handles an empty message list", () => {
    expect(detectCircularArgument([])).toEqual({
      circular: false,
      authors: [],
      repeats: 0,
    });
  });

  it("clamps a non-positive minRepeats up to 1", () => {
    const messages = [
      { authorId: 1, text: "punto" },
      { authorId: 2, text: "contrapunto" },
    ];
    expect(detectCircularArgument(messages, { minRepeats: 0 })).toEqual({
      circular: true,
      authors: [1, 2],
      repeats: 1,
    });
    expect(detectCircularArgument(messages, { minRepeats: -5 })).toEqual({
      circular: true,
      authors: [1, 2],
      repeats: 1,
    });
  });

  it("is deterministic: repeated calls return equal results", () => {
    const messages = [
      { authorId: 2, text: "repito" },
      { authorId: 8, text: "yo tambien" },
      { authorId: 2, text: "repito" },
      { authorId: 8, text: "yo tambien" },
    ];
    const first = detectCircularArgument(messages);
    const second = detectCircularArgument(messages);
    expect(first).toEqual(second);
    expect(first).toEqual({ circular: true, authors: [2, 8], repeats: 2 });
  });
});
