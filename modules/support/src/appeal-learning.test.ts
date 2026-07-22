import { describe, expect, it } from "vitest";
import { buildAppealLearning } from "./appeal-learning.js";

describe("buildAppealLearning", () => {
  it("accepts and promises to refine the quoted rule", () => {
    expect(buildAppealLearning({ accepted: true, rule: "no enlaces" })).toBe(
      "✅ Apelación aceptada. Hemos aprendido de este caso y ajustaremos la regla «no enlaces» para evitar errores futuros. ¡Gracias por ayudarnos a mejorar! 🙌",
    );
  });

  it("rejects politely while upholding the quoted rule", () => {
    expect(buildAppealLearning({ accepted: false, rule: "no enlaces" })).toBe(
      "❌ Apelación rechazada. Tras revisarla, la sanción se mantiene porque la regla «no enlaces» se aplicó correctamente. Gracias por tu comprensión. 🙏",
    );
  });

  it("trims surrounding whitespace from the rule name", () => {
    expect(buildAppealLearning({ accepted: true, rule: "  spam  " })).toBe(
      "✅ Apelación aceptada. Hemos aprendido de este caso y ajustaremos la regla «spam» para evitar errores futuros. ¡Gracias por ayudarnos a mejorar! 🙌",
    );
  });

  it("uses a neutral fallback when the accepted rule is blank", () => {
    expect(buildAppealLearning({ accepted: true, rule: "" })).toBe(
      "✅ Apelación aceptada. Hemos aprendido de este caso y ajustaremos la regla aplicada para evitar errores futuros. ¡Gracias por ayudarnos a mejorar! 🙌",
    );
  });

  it("uses a neutral fallback when the rejected rule is whitespace only", () => {
    expect(buildAppealLearning({ accepted: false, rule: "   " })).toBe(
      "❌ Apelación rechazada. Tras revisarla, la sanción se mantiene porque la regla aplicada se aplicó correctamente. Gracias por tu comprensión. 🙏",
    );
  });

  it("starts accepted messages with a check mark", () => {
    expect(
      buildAppealLearning({ accepted: true, rule: "flood" }).startsWith("✅"),
    ).toBe(true);
  });

  it("starts rejected messages with a cross mark", () => {
    expect(
      buildAppealLearning({ accepted: false, rule: "flood" }).startsWith("❌"),
    ).toBe(true);
  });

  it("produces different messages for accepted and rejected on the same rule", () => {
    const accepted = buildAppealLearning({ accepted: true, rule: "captcha" });
    const rejected = buildAppealLearning({ accepted: false, rule: "captcha" });
    expect(accepted).not.toBe(rejected);
  });

  it("is deterministic for identical input", () => {
    const input = { accepted: true, rule: "no publicidad" } as const;
    expect(buildAppealLearning(input)).toBe(buildAppealLearning(input));
  });
});
