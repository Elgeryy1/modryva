import { describe, expect, it } from "vitest";
import {
  classifyRuleSeverity,
  parseRuleSeverity,
  RULE_SEVERITY_LEVELS,
} from "./rule-severity.js";

describe("classifyRuleSeverity", () => {
  it("classifies leve with rank 1 and green emoji", () => {
    expect(classifyRuleSeverity("leve")).toEqual({
      rank: 1,
      recommendedAction:
        "Aviso amistoso: recuérdale la norma al usuario sin aplicar sanción. 🟢",
      emoji: "🟢",
    });
  });

  it("classifies media with rank 2 and yellow emoji", () => {
    const result = classifyRuleSeverity("media");
    expect(result.rank).toBe(2);
    expect(result.emoji).toBe("🟡");
    expect(result.recommendedAction).toContain("Advertencia formal");
  });

  it("classifies grave with rank 3 and orange emoji", () => {
    const result = classifyRuleSeverity("grave");
    expect(result.rank).toBe(3);
    expect(result.emoji).toBe("🟠");
    expect(result.recommendedAction).toContain("moderación");
  });

  it("classifies expulsion with rank 4 and red emoji", () => {
    expect(classifyRuleSeverity("expulsion")).toEqual({
      rank: 4,
      recommendedAction:
        "¡Expulsión inmediata del grupo con baneo permanente del usuario!",
      emoji: "🔴",
    });
  });

  it("ranks increase deterministically along RULE_SEVERITY_LEVELS", () => {
    const ranks = RULE_SEVERITY_LEVELS.map(
      (level) => classifyRuleSeverity(level).rank,
    );
    expect(ranks).toEqual([1, 2, 3, 4]);
  });

  it("assigns a distinct emoji to every level", () => {
    const emojis = RULE_SEVERITY_LEVELS.map(
      (level) => classifyRuleSeverity(level).emoji,
    );
    expect(new Set(emojis).size).toBe(RULE_SEVERITY_LEVELS.length);
  });

  it("exposes levels in ascending-severity order", () => {
    expect(RULE_SEVERITY_LEVELS).toEqual([
      "leve",
      "media",
      "grave",
      "expulsion",
    ]);
  });
});

describe("parseRuleSeverity", () => {
  it("trims surrounding whitespace and lowercases input", () => {
    expect(parseRuleSeverity("  GRAVE ")).toBe("grave");
    expect(parseRuleSeverity("Media")).toBe("media");
  });

  it("ignores accents when parsing", () => {
    expect(parseRuleSeverity("Expulsión")).toBe("expulsion");
    expect(parseRuleSeverity("  EXPULSIÓN  ")).toBe("expulsion");
  });

  it("returns undefined for undefined, blank or unknown input", () => {
    expect(parseRuleSeverity(undefined)).toBeUndefined();
    expect(parseRuleSeverity("")).toBeUndefined();
    expect(parseRuleSeverity("   ")).toBeUndefined();
    expect(parseRuleSeverity("critico")).toBeUndefined();
  });

  it("parse then classify round-trips every known level", () => {
    for (const level of RULE_SEVERITY_LEVELS) {
      expect(parseRuleSeverity(level)).toBe(level);
      const classified = classifyRuleSeverity(level);
      expect(classified.rank).toBeGreaterThanOrEqual(1);
      expect(classified.rank).toBeLessThanOrEqual(4);
    }
  });
});
