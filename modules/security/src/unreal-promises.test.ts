import { describe, expect, it } from "vitest";
import { detectUnrealPromises } from "./unreal-promises.js";

describe("detectUnrealPromises", () => {
  it("flags multiple curated phrases with a summed score", () => {
    expect(detectUnrealPromises("Dinero fácil y sin riesgo")).toEqual({
      matched: true,
      phrases: ["dinero fácil", "sin riesgo"],
      score: 4,
    });
  });

  it("matches accented and uppercase phrases in PROMISE_PATTERNS order", () => {
    expect(
      detectUnrealPromises(
        "INVERSIÓN GARANTIZADA, ganancias aseguradas y DUPLICA tu dinero",
      ),
    ).toEqual({
      matched: true,
      phrases: [
        "inversión garantizada",
        "duplica tu dinero",
        "ganancias aseguradas",
      ],
      score: 9,
    });
  });

  it("detects an earn-per-period claim with a currency symbol", () => {
    expect(
      detectUnrealPromises("Gana 100€ al día trabajando desde casa"),
    ).toEqual({
      matched: true,
      phrases: ["gana X al día"],
      score: 2,
    });
  });

  it("returns no match for clean text", () => {
    expect(detectUnrealPromises("Hola equipo, ¿cómo va el proyecto?")).toEqual({
      matched: false,
      phrases: [],
      score: 0,
    });
  });

  it("handles undefined", () => {
    expect(detectUnrealPromises(undefined)).toEqual({
      matched: false,
      phrases: [],
      score: 0,
    });
  });

  it("handles empty string", () => {
    expect(detectUnrealPromises("")).toEqual({
      matched: false,
      phrases: [],
      score: 0,
    });
  });

  it("reports matches in pattern order regardless of position in text", () => {
    expect(
      detectUnrealPromises("Aquí hay sin riesgo y también dinero fácil"),
    ).toEqual({
      matched: true,
      phrases: ["dinero fácil", "sin riesgo"],
      score: 4,
    });
  });

  it("de-duplicates repeated curated phrases and repeated earn claims", () => {
    expect(
      detectUnrealPromises(
        "dinero facil, dinero facil. Gana 10 al dia y gana 20 a la semana",
      ),
    ).toEqual({
      matched: true,
      phrases: ["dinero fácil", "gana X al día"],
      score: 4,
    });
  });

  it("does not fire the earn pattern without a numeric amount", () => {
    expect(detectUnrealPromises("gana dinero al día sin esfuerzo")).toEqual({
      matched: false,
      phrases: [],
      score: 0,
    });
  });

  it("combines a curated phrase with an 'a la semana' earn claim", () => {
    expect(
      detectUnrealPromises(
        "Gana 500 a la semana, es una inversión garantizada",
      ),
    ).toEqual({
      matched: true,
      phrases: ["inversión garantizada", "gana X al día"],
      score: 5,
    });
  });

  it("aggregates every pattern into a maximal score", () => {
    expect(
      detectUnrealPromises(
        "Dinero fácil, inversión garantizada, duplica tu dinero, sin riesgo, ganancias aseguradas. Gana 100 al día.",
      ),
    ).toEqual({
      matched: true,
      phrases: [
        "dinero fácil",
        "inversión garantizada",
        "duplica tu dinero",
        "sin riesgo",
        "ganancias aseguradas",
        "gana X al día",
      ],
      score: 15,
    });
  });

  it("is deterministic across repeated calls on the same input", () => {
    const input = "Gana 100 al día";
    const first = detectUnrealPromises(input);
    const second = detectUnrealPromises(input);
    expect(first).toEqual(second);
    expect(first).toEqual({
      matched: true,
      phrases: ["gana X al día"],
      score: 2,
    });
  });
});
