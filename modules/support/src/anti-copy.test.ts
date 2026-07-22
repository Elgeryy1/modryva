import { describe, expect, it } from "vitest";
import { detectAnswerBegging } from "./anti-copy.js";

describe("detectAnswerBegging", () => {
  it("flags a request handing over answers, ignoring accents and case", () => {
    expect(detectAnswerBegging("¡Pásame las respuestas YA!")).toEqual({
      matched: true,
      phrases: ["pasame las respuestas"],
    });
  });

  it("flags multiple phrases in BEGGING_PHRASES order", () => {
    expect(
      detectAnswerBegging("¿Alguien tiene el examen? Me lo haces porfa"),
    ).toEqual({
      matched: true,
      phrases: ["alguien tiene el examen", "me lo haces"],
    });
  });

  it("returns no match for clean text", () => {
    expect(detectAnswerBegging("Hola, buenos dias a todos")).toEqual({
      matched: false,
      phrases: [],
    });
  });

  it("handles undefined", () => {
    expect(detectAnswerBegging(undefined)).toEqual({
      matched: false,
      phrases: [],
    });
  });

  it("handles empty string", () => {
    expect(detectAnswerBegging("")).toEqual({ matched: false, phrases: [] });
  });

  it("preserves canonical order regardless of input order", () => {
    const input =
      "respuestas del test, me lo haces, alguien tiene el examen, pasame las respuestas";
    expect(detectAnswerBegging(input)).toEqual({
      matched: true,
      phrases: [
        "pasame las respuestas",
        "alguien tiene el examen",
        "me lo haces",
        "respuestas del test",
      ],
    });
  });

  it("is accent- and case-insensitive for respuestas del test", () => {
    expect(detectAnswerBegging("Necesito las RESPUESTAS DEL TEST")).toEqual({
      matched: true,
      phrases: ["respuestas del test"],
    });
  });

  it("collapses repeated whitespace between words", () => {
    expect(detectAnswerBegging("pasame    las\trespuestas")).toEqual({
      matched: true,
      phrases: ["pasame las respuestas"],
    });
  });

  it("does not match near-miss phrasing", () => {
    expect(detectAnswerBegging("ya me lo has dicho antes")).toEqual({
      matched: false,
      phrases: [],
    });
  });

  it("is deterministic across repeated calls", () => {
    const input = "Me lo haces y pasame las respuestas";
    const first = detectAnswerBegging(input);
    const second = detectAnswerBegging(input);
    expect(first).toEqual(second);
    expect(first).toEqual({
      matched: true,
      phrases: ["pasame las respuestas", "me lo haces"],
    });
  });
});
