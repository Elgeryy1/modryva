import { describe, expect, it } from "vitest";
import {
  detectPassiveAggressive,
  PASSIVE_AGGRESSIVE_PHRASES,
} from "./passive-aggressive.js";

describe("detectPassiveAggressive", () => {
  it("flags a single known phrase as leve", () => {
    expect(detectPassiveAggressive("como digas")).toEqual({
      matched: true,
      phrases: ["como digas"],
      level: "leve",
    });
  });

  it("is case and accent insensitive", () => {
    expect(detectPassiveAggressive("Si Tú lo dices")).toEqual({
      matched: true,
      phrases: ["si tu lo dices"],
      level: "leve",
    });
  });

  it("matches a phrase embedded in a larger sentence", () => {
    expect(detectPassiveAggressive("En fin, tranquilo genio.")).toEqual({
      matched: true,
      phrases: ["tranquilo genio"],
      level: "leve",
    });
  });

  it("returns alto for two phrases in PASSIVE_AGGRESSIVE_PHRASES order", () => {
    expect(detectPassiveAggressive("Que gracioso, como digas")).toEqual({
      matched: true,
      phrases: ["como digas", "que gracioso"],
      level: "alto",
    });
  });

  it("returns alto for three phrases", () => {
    expect(
      detectPassiveAggressive(
        "Como digas, que original y no esperaba menos de ti",
      ),
    ).toEqual({
      matched: true,
      phrases: ["como digas", "no esperaba menos de ti", "que original"],
      level: "alto",
    });
  });

  it("orders results by the phrase list, not by appearance in the text", () => {
    expect(
      detectPassiveAggressive(
        "no me sorprende viniendo de ti y obvio que no lo entiendes",
      ),
    ).toEqual({
      matched: true,
      phrases: ["obvio que no lo entiendes", "no me sorprende viniendo de ti"],
      level: "alto",
    });
  });

  it("returns ninguno for clean text", () => {
    expect(
      detectPassiveAggressive("buen trabajo, gracias por la ayuda"),
    ).toEqual({
      matched: false,
      phrases: [],
      level: "ninguno",
    });
  });

  it("handles undefined", () => {
    expect(detectPassiveAggressive(undefined)).toEqual({
      matched: false,
      phrases: [],
      level: "ninguno",
    });
  });

  it("handles an empty string", () => {
    expect(detectPassiveAggressive("")).toEqual({
      matched: false,
      phrases: [],
      level: "ninguno",
    });
  });

  it("handles whitespace-only input", () => {
    expect(detectPassiveAggressive("   ")).toEqual({
      matched: false,
      phrases: [],
      level: "ninguno",
    });
  });

  it("is deterministic across repeated calls", () => {
    const input = "Que gracioso, como digas";
    expect(detectPassiveAggressive(input)).toEqual(
      detectPassiveAggressive(input),
    );
  });

  it("keeps a stable ordered phrase list", () => {
    expect([...PASSIVE_AGGRESSIVE_PHRASES]).toEqual([
      "como digas",
      "si tu lo dices",
      "lo que tu digas",
      "obvio que no lo entiendes",
      "que gracioso",
      "tranquilo genio",
      "no me sorprende viniendo de ti",
      "no esperaba menos de ti",
      "que original",
    ]);
  });
});
