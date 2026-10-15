import { describe, expect, it } from "vitest";
import { buildEducationalNotice } from "./educational-notice.js";

describe("buildEducationalNotice", () => {
  it("states the rule and the reason it exists", () => {
    const expected = [
      "📘 Aviso de la comunidad",
      "",
      "📌 Norma: No compartir spam.",
      "💡 Por qué existe: El spam molesta a la comunidad.",
      "",
      "Gracias por tu ayuda para mantener un espacio sano para todos. 🙌",
    ].join("\n");
    expect(
      buildEducationalNotice({
        rule: "no compartir spam",
        why: "el spam molesta a la comunidad",
      }),
    ).toBe(expected);
  });

  it("omits the reason line when why is empty", () => {
    const expected = [
      "📘 Aviso de la comunidad",
      "",
      "📌 Norma: Respeta a los demás.",
      "",
      "Gracias por tu ayuda para mantener un espacio sano para todos. 🙌",
    ].join("\n");
    expect(
      buildEducationalNotice({ rule: "respeta a los demás", why: "" }),
    ).toBe(expected);
  });

  it("falls back to a generic reminder when the rule is blank", () => {
    expect(buildEducationalNotice({ rule: "   ", why: "no importa" })).toBe(
      "📘 Recordatorio: sigamos las normas de la comunidad para que todos estemos a gusto. 🙌",
    );
  });

  it("falls back to the generic reminder when both fields are empty", () => {
    expect(buildEducationalNotice({ rule: "", why: "" })).toBe(
      "📘 Recordatorio: sigamos las normas de la comunidad para que todos estemos a gusto. 🙌",
    );
  });

  it("preserves existing sentence punctuation without duplicating it", () => {
    const expected = [
      "📘 Aviso de la comunidad",
      "",
      "📌 Norma: ¡No insultes!",
      "💡 Por qué existe: Genera un mal ambiente.",
      "",
      "Gracias por tu ayuda para mantener un espacio sano para todos. 🙌",
    ].join("\n");
    expect(
      buildEducationalNotice({
        rule: "¡No insultes!",
        why: "genera un mal ambiente",
      }),
    ).toBe(expected);
  });

  it("does not add a second period when why already ends with one", () => {
    const expected = [
      "📘 Aviso de la comunidad",
      "",
      "📌 Norma: Usa el canal correcto.",
      "💡 Por qué existe: Porque es la norma.",
      "",
      "Gracias por tu ayuda para mantener un espacio sano para todos. 🙌",
    ].join("\n");
    expect(
      buildEducationalNotice({
        rule: "usa el canal correcto",
        why: "porque es la norma.",
      }),
    ).toBe(expected);
  });

  it("trims surrounding whitespace from both fields", () => {
    const expected = [
      "📘 Aviso de la comunidad",
      "",
      "📌 Norma: Sube fotos aquí.",
      "💡 Por qué existe: Mantiene el orden.",
      "",
      "Gracias por tu ayuda para mantener un espacio sano para todos. 🙌",
    ].join("\n");
    expect(
      buildEducationalNotice({
        rule: "   sube fotos aquí   ",
        why: "  mantiene el orden  ",
      }),
    ).toBe(expected);
  });

  it("is deterministic for identical input", () => {
    const input = { rule: "no hagas flood", why: "satura el chat" };
    expect(buildEducationalNotice(input)).toBe(buildEducationalNotice(input));
  });
});
