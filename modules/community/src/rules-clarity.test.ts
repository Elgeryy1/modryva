import { describe, expect, it } from "vitest";
import { detectAmbiguousRule, scoreRulesClarity } from "./rules-clarity.js";

const numbered = (lines: readonly string[]): string =>
  lines.map((line, i) => `${i + 1}. ${line}`).join("\n");

describe("detectAmbiguousRule", () => {
  it("detects the bare 'no' marker as a whole word", () => {
    expect(detectAmbiguousRule("Esto igual no")).toBe(true);
  });

  it("detects 'quizas' with or without accent", () => {
    expect(detectAmbiguousRule("Quizas se pueda hacer")).toBe(true);
    expect(detectAmbiguousRule("Quizás se pueda hacer")).toBe(true);
  });

  it("detects 'depende' and 'segun' (accent-insensitive)", () => {
    expect(detectAmbiguousRule("Depende del caso")).toBe(true);
    expect(detectAmbiguousRule("Según el moderador")).toBe(true);
  });

  it("detects multi-word markers like 'tal vez' and 'a veces'", () => {
    expect(detectAmbiguousRule("Tal vez te avisemos")).toBe(true);
    expect(detectAmbiguousRule("A veces lo permitimos")).toBe(true);
  });

  it("does not flag a clear, unambiguous rule", () => {
    expect(detectAmbiguousRule("Prohibido el spam")).toBe(false);
  });

  it("does not match 'no' embedded inside another word", () => {
    expect(detectAmbiguousRule("Respeta la normativa vigente")).toBe(false);
  });

  it("is deterministic for identical input", () => {
    expect(detectAmbiguousRule("Depende")).toBe(detectAmbiguousRule("Depende"));
  });
});

describe("scoreRulesClarity", () => {
  it("returns score 0 and an issue when there are no rules", () => {
    expect(scoreRulesClarity("")).toEqual({
      score: 0,
      issues: ["Sin reglas definidas"],
    });
    expect(scoreRulesClarity("   \n  \n")).toEqual({
      score: 0,
      issues: ["Sin reglas definidas"],
    });
  });

  it("gives a perfect score to a clean numbered ruleset", () => {
    const text = numbered([
      "Respeta a los demas miembros",
      "Prohibido el spam y la publicidad",
      "Usa el canal correcto para cada tema",
    ]);
    expect(scoreRulesClarity(text)).toEqual({ score: 100, issues: [] });
  });

  it("penalizes an unnumbered ruleset", () => {
    const text = [
      "Respeta a los demas miembros",
      "Prohibido el spam y la publicidad",
      "Usa el canal correcto para cada tema",
    ].join("\n");
    const result = scoreRulesClarity(text);
    expect(result.score).toBe(85);
    expect(result.issues).toContain("Las reglas no estan numeradas");
  });

  it("does not require numbering for a single rule", () => {
    const result = scoreRulesClarity("Respeta a los demas miembros");
    expect(result.score).toBe(100);
    expect(result.issues).toEqual([]);
  });

  it("penalizes ambiguous rules and lists them", () => {
    const text = numbered([
      "Quizas puedas enviar enlaces si depende del tema",
      "Respeta a los demas miembros",
    ]);
    const result = scoreRulesClarity(text);
    expect(result.score).toBe(88);
    expect(result.issues).toContain(
      "1 regla(s) ambiguas (no, quizas, depende, tal vez...)",
    );
  });

  it("penalizes rules that are too long", () => {
    const longRule = `1. ${"palabra ".repeat(30).trim()}`;
    const result = scoreRulesClarity(`${longRule}\n2. Respeta a todos`);
    expect(result.issues.some((i) => i.includes("demasiado largas"))).toBe(
      true,
    );
    expect(result.score).toBeLessThan(100);
  });

  it("detects a contradiction between permitted and prohibited topics", () => {
    const text = numbered([
      "Los enlaces estan permitidos siempre",
      "Los enlaces estan prohibidos totalmente",
    ]);
    const result = scoreRulesClarity(text);
    expect(
      result.issues.some((i) => i.startsWith("Posible contradiccion")),
    ).toBe(true);
    expect(result.score).toBe(80);
  });

  it("does not flag a contradiction when topics differ", () => {
    const text = numbered([
      "Los enlaces estan permitidos siempre",
      "El spam esta prohibido totalmente",
    ]);
    const result = scoreRulesClarity(text);
    expect(
      result.issues.some((i) => i.startsWith("Posible contradiccion")),
    ).toBe(false);
  });

  it("dedupes the same contradicted topic across rules", () => {
    const text = numbered([
      "Los stickers estan permitidos",
      "Los stickers estan prohibidos",
      "Los stickers estan permitidos de nuevo",
    ]);
    const result = scoreRulesClarity(text);
    const contradictionIssues = result.issues.filter((i) =>
      i.startsWith("Posible contradiccion"),
    );
    expect(contradictionIssues).toHaveLength(1);
  });

  it("clamps the score to 0 and never goes negative", () => {
    const badLines: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      badLines.push("quizas no se depende tal vez a veces segun capaz");
    }
    const result = scoreRulesClarity(badLines.join("\n"));
    expect(result.score).toBe(0);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("accumulates multiple kinds of issues at once", () => {
    const text = [
      "Los enlaces estan permitidos",
      "Los enlaces estan prohibidos",
      "Quizas hagamos excepciones",
    ].join("\n");
    const result = scoreRulesClarity(text);
    expect(result.issues.length).toBeGreaterThanOrEqual(3);
    expect(result.score).toBeLessThan(60);
  });

  it("returns a readonly issues array and integer score", () => {
    const result = scoreRulesClarity(numbered(["Respeta a los demas"]));
    expect(Array.isArray(result.issues)).toBe(true);
    expect(Number.isInteger(result.score)).toBe(true);
  });

  it("is deterministic across repeated calls", () => {
    const text = numbered(["Quizas envies enlaces", "Prohibido el spam"]);
    expect(scoreRulesClarity(text)).toEqual(scoreRulesClarity(text));
  });

  it("keeps the score within 0..100 for arbitrary input", () => {
    const result = scoreRulesClarity("solo una linea rara @#$%");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
