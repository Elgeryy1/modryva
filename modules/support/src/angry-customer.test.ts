import { describe, expect, it } from "vitest";
import { detectAngerLevel, isHighFrustration } from "./angry-customer.js";

describe("detectAngerLevel", () => {
  it("returns ninguno for undefined text", () => {
    expect(detectAngerLevel(undefined)).toEqual({
      level: "ninguno",
      score: 0,
      hits: [],
    });
  });

  it("returns ninguno for empty or whitespace-only text", () => {
    expect(detectAngerLevel("")).toEqual({
      level: "ninguno",
      score: 0,
      hits: [],
    });
    expect(detectAngerLevel("   ")).toEqual({
      level: "ninguno",
      score: 0,
      hits: [],
    });
  });

  it("returns ninguno for polite clean text", () => {
    expect(detectAngerLevel("Hola, muchas gracias por la ayuda")).toEqual({
      level: "ninguno",
      score: 0,
      hits: [],
    });
  });

  it("flags a single anger keyword as leve", () => {
    expect(detectAngerLevel("El producto es pesimo")).toEqual({
      level: "leve",
      score: 2,
      hits: ["pesimo"],
    });
  });

  it("normalizes accents so accented input matches ASCII terms", () => {
    expect(detectAngerLevel("Que vergüenza de servicio")).toEqual({
      level: "leve",
      score: 2,
      hits: ["verguenza"],
    });
  });

  it("flags all-caps shouting as leve without keywords", () => {
    expect(detectAngerLevel("HOLA NECESITO AYUDA AHORA")).toEqual({
      level: "leve",
      score: 2,
      hits: ["mayusculas"],
    });
  });

  it("flags repeated punctuation as leve", () => {
    expect(detectAngerLevel("hola??? alguien???")).toEqual({
      level: "leve",
      score: 1,
      hits: ["puntuacion"],
    });
  });

  it("combines keyword, shouting and punctuation into alto", () => {
    expect(detectAngerLevel("ESTO ES UNA ESTAFA!!!")).toEqual({
      level: "alto",
      score: 5,
      hits: ["estafa", "mayusculas", "puntuacion"],
    });
  });

  it("lists multiple keywords in ANGER_TERMS order, not text order", () => {
    expect(detectAngerLevel("que basura, es un fraude y una estafa")).toEqual({
      level: "alto",
      score: 6,
      hits: ["estafa", "fraude", "basura"],
    });
  });

  it("deduplicates a repeated keyword so it scores once", () => {
    expect(detectAngerLevel("pesimo pesimo pesimo")).toEqual({
      level: "leve",
      score: 2,
      hits: ["pesimo"],
    });
  });

  it("ignores weak or short signals at the boundaries", () => {
    expect(detectAngerLevel("gracias!!")).toEqual({
      level: "ninguno",
      score: 0,
      hits: [],
    });
    expect(detectAngerLevel("OK")).toEqual({
      level: "ninguno",
      score: 0,
      hits: [],
    });
  });

  it("is deterministic across repeated calls", () => {
    const first = detectAngerLevel("ESTAFA!!!");
    const second = detectAngerLevel("ESTAFA!!!");
    expect(first).toEqual(second);
    expect(first).toEqual({
      level: "alto",
      score: 5,
      hits: ["estafa", "mayusculas", "puntuacion"],
    });
  });

  it("isHighFrustration flags only alto-level messages", () => {
    expect(isHighFrustration("ESTO ES UNA ESTAFA!!!")).toBe(true);
    expect(isHighFrustration("El producto es pesimo")).toBe(false);
    expect(isHighFrustration(undefined)).toBe(false);
  });
});
