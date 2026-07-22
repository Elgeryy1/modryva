import { describe, expect, it } from "vitest";
import {
  DEFAULT_RULES_MOBILE_MAX_CHARS,
  summarizeRulesMobile,
} from "./rules-mobile.js";

const ELLIPSIS = "…";

describe("summarizeRulesMobile", () => {
  it("truncates a long rule to the default budget with a trailing ellipsis", () => {
    const rule = "a".repeat(70);
    expect(summarizeRulesMobile([rule])).toEqual({
      short: ["a".repeat(59) + ELLIPSIS],
      full: [rule],
    });
  });

  it("leaves a rule exactly at the default budget untouched", () => {
    const rule = "a".repeat(DEFAULT_RULES_MOBILE_MAX_CHARS);
    expect(summarizeRulesMobile([rule]).short).toEqual([rule]);
  });

  it("truncates a rule one character over the default budget", () => {
    const rule = "a".repeat(DEFAULT_RULES_MOBILE_MAX_CHARS + 1);
    expect(summarizeRulesMobile([rule]).short).toEqual([
      "a".repeat(59) + ELLIPSIS,
    ]);
  });

  it("respects a custom maxChars and only cuts the rules that overflow", () => {
    const rules = ["Hola", "Hola mundo", "HolaX"];
    expect(summarizeRulesMobile(rules, { maxChars: 5 })).toEqual({
      short: ["Hola", `Hola${ELLIPSIS}`, "HolaX"],
      full: ["Hola", "Hola mundo", "HolaX"],
    });
  });

  it("returns empty variants for an empty rule list", () => {
    expect(summarizeRulesMobile([], { maxChars: 10 })).toEqual({
      short: [],
      full: [],
    });
  });

  it("keeps empty-string rules as empty strings", () => {
    const rules = ["", "a".repeat(70)];
    expect(summarizeRulesMobile(rules).short).toEqual([
      "",
      "a".repeat(59) + ELLIPSIS,
    ]);
  });

  it("clamps a maxChars below one up to one", () => {
    expect(summarizeRulesMobile(["Hola mundo"], { maxChars: 0 }).short).toEqual(
      [ELLIPSIS],
    );
    expect(
      summarizeRulesMobile(["Hola mundo"], { maxChars: -5 }).short,
    ).toEqual([ELLIPSIS]);
  });

  it("floors a fractional maxChars", () => {
    expect(
      summarizeRulesMobile(["Hola mundo"], { maxChars: 3.9 }).short,
    ).toEqual([`Ho${ELLIPSIS}`]);
  });

  it("falls back to the default budget for a non-finite maxChars", () => {
    const rule = "a".repeat(70);
    expect(
      summarizeRulesMobile([rule], { maxChars: Number.NaN }).short,
    ).toEqual(["a".repeat(59) + ELLIPSIS]);
  });

  it("preserves order and keeps short and full aligned in length", () => {
    const rules = ["uno", "dos", "tres"];
    const result = summarizeRulesMobile(rules);
    expect(result.full).toEqual(["uno", "dos", "tres"]);
    expect(result.short).toEqual(["uno", "dos", "tres"]);
    expect(result.short.length).toBe(rules.length);
    expect(result.full.length).toBe(rules.length);
  });

  it("keeps accented Spanish rules intact when within budget", () => {
    const rule = "Sé respetuoso con los demás";
    const result = summarizeRulesMobile([rule]);
    expect(result.short).toEqual([rule]);
    expect(result.full).toEqual([rule]);
  });

  it("is deterministic across repeated calls", () => {
    const rules = ["Hola mundo", "a".repeat(70), ""];
    const first = summarizeRulesMobile(rules, { maxChars: 5 });
    const second = summarizeRulesMobile(rules, { maxChars: 5 });
    expect(first).toEqual(second);
  });
});
