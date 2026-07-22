import { describe, expect, it } from "vitest";
import {
  detectSocialManipulation,
  SOCIAL_MANIPULATION_PATTERNS,
} from "./social-manipulation.js";

describe("detectSocialManipulation", () => {
  it("detects a single manipulation phrase", () => {
    expect(
      detectSocialManipulation("Es obvio para todos que esto funciona"),
    ).toEqual({ matched: true, phrases: ["es obvio para todos"] });
  });

  it("is case-insensitive", () => {
    expect(detectSocialManipulation("TODO EL MUNDO SABE esto")).toEqual({
      matched: true,
      phrases: ["todo el mundo sabe"],
    });
  });

  it("ignores accents and punctuation around the phrase", () => {
    expect(
      detectSocialManipulation("Todo el mundo sabe que sí, ¿verdad?"),
    ).toEqual({ matched: true, phrases: ["todo el mundo sabe"] });
  });

  it("collapses extra whitespace between words", () => {
    expect(
      detectSocialManipulation("todos    pensamos\n que estas mal"),
    ).toEqual({
      matched: true,
      phrases: ["todos pensamos que"],
    });
  });

  it("detects the long shaming phrase", () => {
    expect(
      detectSocialManipulation("Cualquiera con dos dedos de frente lo ve"),
    ).toEqual({
      matched: true,
      phrases: ["cualquiera con dos dedos de frente"],
    });
  });

  it("returns matches in pattern order, not text order (deterministic)", () => {
    expect(
      detectSocialManipulation(
        "Nadie te va a apoyar y todos pensamos que estas equivocado",
      ),
    ).toEqual({
      matched: true,
      phrases: ["todos pensamos que", "nadie te va a apoyar"],
    });
  });

  it("orders three matches by SOCIAL_MANIPULATION_PATTERNS", () => {
    expect(
      detectSocialManipulation(
        "Es obvio para todos, nadie te va a creer, todo el mundo sabe la verdad.",
      ),
    ).toEqual({
      matched: true,
      phrases: [
        "todo el mundo sabe",
        "nadie te va a creer",
        "es obvio para todos",
      ],
    });
  });

  it("deduplicates a repeated phrase", () => {
    expect(
      detectSocialManipulation("Todo el mundo sabe. Todo el mundo sabe."),
    ).toEqual({ matched: true, phrases: ["todo el mundo sabe"] });
  });

  it("returns no match for clean text", () => {
    expect(detectSocialManipulation("hola, buenos dias a todos")).toEqual({
      matched: false,
      phrases: [],
    });
  });

  it("handles undefined", () => {
    expect(detectSocialManipulation(undefined)).toEqual({
      matched: false,
      phrases: [],
    });
  });

  it("handles empty and whitespace-only text", () => {
    expect(detectSocialManipulation("")).toEqual({
      matched: false,
      phrases: [],
    });
    expect(detectSocialManipulation("   \n\t ")).toEqual({
      matched: false,
      phrases: [],
    });
  });

  it("matches every phrase in SOCIAL_MANIPULATION_PATTERNS on its own", () => {
    for (const pattern of SOCIAL_MANIPULATION_PATTERNS) {
      expect(detectSocialManipulation(pattern)).toEqual({
        matched: true,
        phrases: [pattern],
      });
    }
  });
});
