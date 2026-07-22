import { describe, expect, it } from "vitest";
import { findDuplicateRules, type SimpleRule } from "./rule-dedup.js";

const rule = (id: string, trigger: string, action: string): SimpleRule => ({
  id,
  trigger,
  action,
});

describe("findDuplicateRules", () => {
  it("groups rules with the same trigger and action", () => {
    const rules = [
      rule("r1", "contains link", "delete"),
      rule("r2", "contains link", "delete"),
      rule("r3", "contains spam", "warn"),
    ];
    expect(findDuplicateRules(rules)).toEqual([["r1", "r2"]]);
  });

  it("normalizes case and accents when comparing", () => {
    const rules = [
      rule("a", "Contiene Enlace", "Borrar"),
      rule("b", "contiene enláce", "borrar"),
    ];
    expect(findDuplicateRules(rules)).toEqual([["a", "b"]]);
  });

  it("collapses whitespace differences", () => {
    const rules = [
      rule("a", "contains   link", "delete"),
      rule("b", "contains link", "delete"),
    ];
    expect(findDuplicateRules(rules)).toEqual([["a", "b"]]);
  });

  it("does not group different trigger or action", () => {
    const rules = [
      rule("a", "contains link", "delete"),
      rule("b", "contains link", "warn"),
    ];
    expect(findDuplicateRules(rules)).toEqual([]);
  });

  it("returns multiple groups in first-appearance order", () => {
    const rules = [
      rule("a", "t1", "x"),
      rule("b", "t2", "y"),
      rule("c", "t1", "x"),
      rule("d", "t2", "y"),
    ];
    expect(findDuplicateRules(rules)).toEqual([
      ["a", "c"],
      ["b", "d"],
    ]);
  });

  it("returns empty when all rules are unique", () => {
    expect(
      findDuplicateRules([rule("a", "t1", "x"), rule("b", "t2", "y")]),
    ).toEqual([]);
  });

  it("returns empty for no rules", () => {
    expect(findDuplicateRules([])).toEqual([]);
  });

  it("groups three identical rules together", () => {
    const rules = [
      rule("a", "t", "x"),
      rule("b", "t", "x"),
      rule("c", "t", "x"),
    ];
    expect(findDuplicateRules(rules)).toEqual([["a", "b", "c"]]);
  });

  it("is deterministic", () => {
    const rules = [rule("a", "t", "x"), rule("b", "t", "x")];
    expect(findDuplicateRules(rules)).toEqual(findDuplicateRules(rules));
  });
});
