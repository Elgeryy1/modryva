import { describe, expect, it } from "vitest";
import { searchRules } from "./rules-search.js";

const RULES: readonly string[] = [
  "No se permiten links de publicidad",
  "Prohibido compartir enlaces de spam",
  "Los LINKS externos requieren aprobacion",
  "Respeta a los demas miembros",
];

const ACCENTED_RULES: readonly string[] = [
  "Política de moderación del grupo",
  "Normas de convivencia sana",
];

describe("searchRules", () => {
  it("returns matching rules in source order with their original index", () => {
    expect(searchRules(RULES, "links")).toEqual([
      { index: 0, text: "No se permiten links de publicidad" },
      { index: 2, text: "Los LINKS externos requieren aprobacion" },
    ]);
  });

  it("matches case-insensitively", () => {
    expect(searchRules(RULES, "PUBLICIDAD")).toEqual([
      { index: 0, text: "No se permiten links de publicidad" },
    ]);
  });

  it("matches ignoring accents when the query is unaccented", () => {
    expect(searchRules(ACCENTED_RULES, "moderacion")).toEqual([
      { index: 0, text: "Política de moderación del grupo" },
    ]);
  });

  it("matches ignoring accents when the query is accented", () => {
    expect(searchRules(ACCENTED_RULES, "POLÍTICA")).toEqual([
      { index: 0, text: "Política de moderación del grupo" },
    ]);
  });

  it("matches on partial-word substrings", () => {
    expect(searchRules(RULES, "link")).toEqual([
      { index: 0, text: "No se permiten links de publicidad" },
      { index: 2, text: "Los LINKS externos requieren aprobacion" },
    ]);
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(searchRules(RULES, "  links  ")).toEqual([
      { index: 0, text: "No se permiten links de publicidad" },
      { index: 2, text: "Los LINKS externos requieren aprobacion" },
    ]);
  });

  it("returns an empty array for an empty query", () => {
    expect(searchRules(RULES, "")).toEqual([]);
  });

  it("returns an empty array for a whitespace-only query", () => {
    expect(searchRules(RULES, "   ")).toEqual([]);
  });

  it("returns an empty array when no rule matches", () => {
    expect(searchRules(RULES, "casino")).toEqual([]);
  });

  it("returns an empty array for an empty rules list", () => {
    expect(searchRules([], "links")).toEqual([]);
  });

  it("is deterministic across repeated calls", () => {
    const first = searchRules(RULES, "links");
    const second = searchRules(RULES, "links");
    expect(first).toEqual(second);
    expect(first.map((match) => match.index)).toEqual([0, 2]);
  });
});
