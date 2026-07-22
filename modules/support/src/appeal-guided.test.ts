import { describe, expect, it } from "vitest";
import {
  APPEAL_ANSWER_MIN_LENGTH,
  APPEAL_STEPS,
  classifyAppeal,
  nextAppealStep,
  validateAppealAnswer,
} from "./appeal-guided.js";

describe("APPEAL_STEPS", () => {
  it("has the three ordered steps: what, why, learned", () => {
    expect(APPEAL_STEPS.map((step) => step.id)).toEqual([
      "what",
      "why",
      "learned",
    ]);
  });

  it("gives every step a non-empty question", () => {
    for (const step of APPEAL_STEPS) {
      expect(step.question.length).toBeGreaterThan(0);
    }
  });

  it("has unique step ids", () => {
    const ids = APPEAL_STEPS.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("nextAppealStep", () => {
  it("returns the following step id", () => {
    expect(nextAppealStep("what")).toBe("why");
    expect(nextAppealStep("why")).toBe("learned");
  });

  it("returns null for the last step", () => {
    expect(nextAppealStep("learned")).toBeNull();
  });

  it("returns null for an unknown step id", () => {
    expect(nextAppealStep("nope")).toBeNull();
    expect(nextAppealStep("")).toBeNull();
  });

  it("is deterministic across calls", () => {
    expect(nextAppealStep("what")).toBe(nextAppealStep("what"));
  });
});

describe("classifyAppeal", () => {
  it("classifies insults to the staff as abuso", () => {
    const result = classifyAppeal("sois unos idiotas y esto es una mierda");
    expect(result.kind).toBe("abuso");
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("abuso wins even when regret words are also present", () => {
    const result = classifyAppeal("perdon pero el moderador es un imbecil");
    expect(result.kind).toBe("abuso");
  });

  it("classifies a claim of mistake as error", () => {
    const result = classifyAppeal("esto es un error, yo no hice nada malo");
    expect(result.kind).toBe("error");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("classifies owning up as arrepentimiento", () => {
    const result = classifyAppeal(
      "lo siento mucho, me equivoque y no volvera a pasar",
    );
    expect(result.kind).toBe("arrepentimiento");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("classifies bewilderment as confusion", () => {
    const result = classifyAppeal("no entiendo que hice para que me banearan");
    expect(result.kind).toBe("confusion");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("returns confusion with confidence 0 for no keyword hits", () => {
    expect(classifyAppeal("xyz abcdef ghijk")).toEqual({
      kind: "confusion",
      confidence: 0,
    });
  });

  it("caps confidence at 1", () => {
    const result = classifyAppeal(
      "idiota imbecil estupido cabron puto mierda basura inutil",
    );
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("is case-insensitive", () => {
    expect(classifyAppeal("LO SIENTO, ME EQUIVOQUE").kind).toBe(
      "arrepentimiento",
    );
  });

  it("grows confidence with more matching keywords", () => {
    const few = classifyAppeal("lo siento");
    const many = classifyAppeal("lo siento, me equivoque, prometo, aprendi");
    expect(many.confidence).toBeGreaterThan(few.confidence);
  });

  it("is deterministic for identical input", () => {
    const text = "no entiendo por que me banearon";
    expect(classifyAppeal(text)).toEqual(classifyAppeal(text));
  });
});

describe("validateAppealAnswer", () => {
  it("rejects an empty answer", () => {
    const result = validateAppealAnswer("");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hint.length).toBeGreaterThan(0);
    }
  });

  it("rejects a whitespace-only answer", () => {
    expect(validateAppealAnswer("     ").ok).toBe(false);
  });

  it("rejects an answer shorter than the minimum", () => {
    const result = validateAppealAnswer("corto");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hint).toContain(String(APPEAL_ANSWER_MIN_LENGTH));
    }
  });

  it("rejects an insult-only answer", () => {
    const result = validateAppealAnswer("idiotas idiotas imbecil cabrones");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hint).toContain("sin insultar");
    }
  });

  it("accepts a substantive answer", () => {
    expect(
      validateAppealAnswer("Fue un malentendido y ya lo entendi."),
    ).toEqual({ ok: true });
  });

  it("accepts an answer with an insult plus real explanation", () => {
    expect(
      validateAppealAnswer(
        "se que fui un idiota pero de verdad quiero corregir mi actitud",
      ),
    ).toEqual({ ok: true });
  });

  it("accepts an answer exactly at the minimum length", () => {
    const answer = "a".repeat(APPEAL_ANSWER_MIN_LENGTH);
    expect(validateAppealAnswer(answer)).toEqual({ ok: true });
  });

  it("is deterministic for identical input", () => {
    const answer = "Perdon por lo ocurrido, no se repetira.";
    expect(validateAppealAnswer(answer)).toEqual(validateAppealAnswer(answer));
  });
});
