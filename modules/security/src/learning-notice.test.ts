import { describe, expect, it } from "vitest";
import { buildLearningNotice } from "./learning-notice.js";

describe("buildLearningNotice", () => {
  it("includes header, intro, rule, example and closing in order", () => {
    expect(
      buildLearningNotice({
        rule: "No enviar spam",
        example: "Publicar el mismo enlace 10 veces",
      }),
    ).toBe(
      [
        "📚 Nota de aprendizaje",
        "Has recibido una advertencia para que puedas mejorar.",
        "Norma: No enviar spam",
        "Ejemplo: Publicar el mismo enlace 10 veces",
        "Revísala con calma y evitarás nuevas sanciones. 🙌",
      ].join("\n"),
    );
  });

  it("omits the example line when example is empty", () => {
    expect(
      buildLearningNotice({ rule: "Respeta a los demas", example: "" }),
    ).toBe(
      [
        "📚 Nota de aprendizaje",
        "Has recibido una advertencia para que puedas mejorar.",
        "Norma: Respeta a los demas",
        "Revísala con calma y evitarás nuevas sanciones. 🙌",
      ].join("\n"),
    );
  });

  it("omits the example line when example is only whitespace", () => {
    const notice = buildLearningNotice({
      rule: "No hagas flood",
      example: "   ",
    });
    expect(notice.includes("Ejemplo:")).toBe(false);
  });

  it("uses a fallback phrase when the rule is empty", () => {
    const notice = buildLearningNotice({
      rule: "",
      example: "Mensaje ofensivo",
    });
    expect(notice.includes("Norma: la norma del grupo")).toBe(true);
  });

  it("uses the fallback phrase when the rule is only whitespace", () => {
    const notice = buildLearningNotice({ rule: "  \t ", example: "" });
    expect(notice.includes("Norma: la norma del grupo")).toBe(true);
  });

  it("trims surrounding whitespace from rule and example", () => {
    expect(
      buildLearningNotice({ rule: "  No enlaces  ", example: "  spam.com  " }),
    ).toBe(
      [
        "📚 Nota de aprendizaje",
        "Has recibido una advertencia para que puedas mejorar.",
        "Norma: No enlaces",
        "Ejemplo: spam.com",
        "Revísala con calma y evitarás nuevas sanciones. 🙌",
      ].join("\n"),
    );
  });

  it("returns exactly five lines when an example is present", () => {
    const notice = buildLearningNotice({
      rule: "Sin insultos",
      example: "Palabras groseras",
    });
    expect(notice.split("\n")).toHaveLength(5);
  });

  it("returns exactly four lines when the example is absent", () => {
    const notice = buildLearningNotice({ rule: "Sin insultos", example: "" });
    expect(notice.split("\n")).toHaveLength(4);
  });

  it("starts with the header and ends with the closing", () => {
    const notice = buildLearningNotice({
      rule: "Norma X",
      example: "Ejemplo X",
    });
    const parts = notice.split("\n");
    expect(parts[0]).toBe("📚 Nota de aprendizaje");
    expect(parts[parts.length - 1]).toBe(
      "Revísala con calma y evitarás nuevas sanciones. 🙌",
    );
  });

  it("is deterministic for identical input", () => {
    const input = { rule: "No spam", example: "Enlace repetido" };
    expect(buildLearningNotice(input)).toBe(buildLearningNotice(input));
  });
});
