import { describe, expect, it } from "vitest";
import { DRAMATIC_EXIT_PHRASES, detectDramaticExit } from "./dramatic-exit.js";

describe("detectDramaticExit", () => {
  it("detects a single exact phrase", () => {
    expect(detectDramaticExit("me voy del grupo")).toEqual({
      matched: true,
      phrases: ["me voy del grupo"],
    });
  });

  it("is case-insensitive and accent-insensitive", () => {
    expect(detectDramaticExit("¡Adiós a todos!")).toEqual({
      matched: true,
      phrases: ["adios a todos"],
    });
  });

  it("matches accented imperative forms like Bórrenme", () => {
    expect(detectDramaticExit("Bórrenme del grupo ya")).toEqual({
      matched: true,
      phrases: ["borrenme"],
    });
  });

  it("returns phrases in DRAMATIC_EXIT_PHRASES order regardless of input order", () => {
    expect(detectDramaticExit("hasta nunca y me largo")).toEqual({
      matched: true,
      phrases: ["me largo", "hasta nunca"],
    });
  });

  it("collapses extra whitespace and newlines between words", () => {
    expect(detectDramaticExit("me   voy\ndel  grupo")).toEqual({
      matched: true,
      phrases: ["me voy del grupo"],
    });
  });

  it("deduplicates a phrase that appears multiple times", () => {
    expect(detectDramaticExit("me largo, me largo!")).toEqual({
      matched: true,
      phrases: ["me largo"],
    });
  });

  it("detects several distinct phrases at once, in canonical order", () => {
    expect(
      detectDramaticExit("Me voy del grupo, adios a todos, hasta nunca"),
    ).toEqual({
      matched: true,
      phrases: ["me voy del grupo", "adios a todos", "hasta nunca"],
    });
  });

  it("normalizes accents in no vuelvo mas", () => {
    expect(detectDramaticExit("Ya no vuelvo más aquí")).toEqual({
      matched: true,
      phrases: ["no vuelvo mas"],
    });
  });

  it("returns no match for clean text", () => {
    expect(detectDramaticExit("hola que tal, seguimos aqui")).toEqual({
      matched: false,
      phrases: [],
    });
  });

  it("handles undefined, empty and whitespace-only input", () => {
    const empty = { matched: false, phrases: [] };
    expect(detectDramaticExit(undefined)).toEqual(empty);
    expect(detectDramaticExit("")).toEqual(empty);
    expect(detectDramaticExit("   \n\t  ")).toEqual(empty);
  });

  it("exposes a stable, non-empty ordered phrase list", () => {
    expect(DRAMATIC_EXIT_PHRASES[0]).toBe("me voy del grupo");
    expect(DRAMATIC_EXIT_PHRASES.length).toBe(6);
  });
});
