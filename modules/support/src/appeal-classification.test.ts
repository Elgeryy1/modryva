import { describe, expect, it } from "vitest";
import { categorizeAppeal } from "./appeal-classification.js";

describe("categorizeAppeal", () => {
  it("classifies abuse and prioritizes it over an error claim", () => {
    expect(categorizeAppeal("Sois unos idiotas, esto es un error")).toEqual({
      category: "abuso",
      hits: ["idiota"],
    });
  });

  it("classifies error claims preserving keyword-set order", () => {
    expect(categorizeAppeal("Creo que fue un error, yo no hice nada")).toEqual({
      category: "error",
      hits: ["error", "no hice nada"],
    });
  });

  it("classifies remorse and normalizes Spanish accents", () => {
    expect(
      categorizeAppeal("Lo siento mucho, perdón, no volverá a pasar"),
    ).toEqual({
      category: "arrepentimiento",
      hits: ["perdon", "lo siento", "no volvera a pasar"],
    });
  });

  it("classifies confusion", () => {
    expect(categorizeAppeal("No entiendo por qué me banearon")).toEqual({
      category: "confusion",
      hits: ["no entiendo", "por que"],
    });
  });

  it("returns sin_clasificar for unrelated text", () => {
    expect(categorizeAppeal("Hola, buenos dias equipo")).toEqual({
      category: "sin_clasificar",
      hits: [],
    });
  });

  it("handles undefined input", () => {
    expect(categorizeAppeal(undefined)).toEqual({
      category: "sin_clasificar",
      hits: [],
    });
  });

  it("handles empty text", () => {
    expect(categorizeAppeal("")).toEqual({
      category: "sin_clasificar",
      hits: [],
    });
  });

  it("handles whitespace-only text", () => {
    expect(categorizeAppeal("   ")).toEqual({
      category: "sin_clasificar",
      hits: [],
    });
  });

  it("resolves priority abuso > error > arrepentimiento > confusion", () => {
    expect(
      categorizeAppeal("Idiotas, fue un error, lo siento, no entiendo por qué"),
    ).toEqual({
      category: "abuso",
      hits: ["idiota"],
    });
  });

  it("prefers arrepentimiento over confusion when no abuse or error is present", () => {
    expect(categorizeAppeal("Perdón, no entiendo")).toEqual({
      category: "arrepentimiento",
      hits: ["perdon"],
    });
  });

  it("is case-insensitive", () => {
    expect(categorizeAppeal("IDIOTA")).toEqual({
      category: "abuso",
      hits: ["idiota"],
    });
  });

  it("collapses repeated matches to one hit and is deterministic", () => {
    const input = "error error error";
    const first = categorizeAppeal(input);
    const second = categorizeAppeal(input);
    expect(first).toEqual({ category: "error", hits: ["error"] });
    expect(second).toEqual(first);
  });
});
