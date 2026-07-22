import { describe, expect, it } from "vitest";
import { validateRuleExplanation } from "./rule-explanation.js";

describe("validateRuleExplanation", () => {
  it("accepts a rule with a sufficiently long explanation", () => {
    expect(
      validateRuleExplanation({
        name: "anti-spam",
        explanation: "Bloquea enlaces externos de cuentas nuevas.",
      }),
    ).toEqual({ valid: true });
  });

  it("omits the issue property when valid", () => {
    const result = validateRuleExplanation({
      name: "anti-spam",
      explanation: "Bloquea enlaces externos de cuentas nuevas.",
    });
    expect(Object.hasOwn(result, "issue")).toBe(false);
  });

  it("rejects an empty explanation with the empty-message issue", () => {
    expect(
      validateRuleExplanation({ name: "bienvenida", explanation: "" }),
    ).toEqual({
      valid: false,
      issue:
        "La regla «bienvenida» debe explicar por qué existe: la explicación no puede estar vacía. ✍️",
    });
  });

  it("treats a whitespace-only explanation as empty", () => {
    expect(
      validateRuleExplanation({ name: "bienvenida", explanation: "   " }),
    ).toEqual({
      valid: false,
      issue:
        "La regla «bienvenida» debe explicar por qué existe: la explicación no puede estar vacía. ✍️",
    });
  });

  it("rejects an explanation shorter than 10 characters", () => {
    expect(
      validateRuleExplanation({ name: "mute", explanation: "muy corto" }),
    ).toEqual({
      valid: false,
      issue:
        "La explicación de la regla «mute» es demasiado corta: se requieren al menos 10 caracteres. ✍️",
    });
  });

  it("accepts an explanation of exactly 10 characters", () => {
    expect(
      validateRuleExplanation({ name: "mute", explanation: "diez chars" }),
    ).toEqual({ valid: true });
  });

  it("counts length after trimming surrounding whitespace", () => {
    expect(
      validateRuleExplanation({ name: "mute", explanation: "   corto   " }),
    ).toEqual({
      valid: false,
      issue:
        "La explicación de la regla «mute» es demasiado corta: se requieren al menos 10 caracteres. ✍️",
    });
  });

  it("uses a fallback label when the name is blank", () => {
    expect(validateRuleExplanation({ name: "   ", explanation: "" })).toEqual({
      valid: false,
      issue:
        "La regla «sin nombre» debe explicar por qué existe: la explicación no puede estar vacía. ✍️",
    });
  });

  it("is deterministic across repeated calls with the same input", () => {
    const input = { name: "flood", explanation: "corto" } as const;
    const first = validateRuleExplanation(input);
    const second = validateRuleExplanation(input);
    expect(first).toEqual(second);
    expect(first.valid).toBe(false);
  });
});
