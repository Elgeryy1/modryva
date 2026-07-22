import { describe, expect, it } from "vitest";
import { type FaqItem, suggestFaqAnswers } from "./proactive-faq.js";

const FAQ: readonly FaqItem[] = [
  { q: "¿Cómo cambio mi contraseña?", a: "Ve a ajustes y pulsa cambiar." },
  { q: "¿Dónde veo mi saldo?", a: "En el panel principal." },
  { q: "¿Cómo activo las notificaciones?", a: "Desde ajustes de avisos." },
];

describe("suggestFaqAnswers", () => {
  it("ranks entries by shared normalized words, ignoring accents", () => {
    expect(suggestFaqAnswers("¿Cómo reinicio mi contraseña?", FAQ)).toEqual([
      {
        q: "¿Cómo cambio mi contraseña?",
        a: "Ve a ajustes y pulsa cambiar.",
        score: 3,
      },
      {
        q: "¿Cómo activo las notificaciones?",
        a: "Desde ajustes de avisos.",
        score: 1,
      },
      { q: "¿Dónde veo mi saldo?", a: "En el panel principal.", score: 1 },
    ]);
  });

  it("excludes entries with zero shared words", () => {
    expect(suggestFaqAnswers("saldo", FAQ)).toEqual([
      { q: "¿Dónde veo mi saldo?", a: "En el panel principal.", score: 1 },
    ]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(suggestFaqAnswers("xyz reembolso factura", FAQ)).toEqual([]);
  });

  it("breaks score ties by question text ascending", () => {
    const tied: readonly FaqItem[] = [
      { q: "pago con tarjeta", a: "A1" },
      { q: "pago con paypal", a: "A2" },
    ];
    expect(suggestFaqAnswers("pago con", tied)).toEqual([
      { q: "pago con paypal", a: "A2", score: 2 },
      { q: "pago con tarjeta", a: "A1", score: 2 },
    ]);
  });

  it("respects a custom limit", () => {
    const tied: readonly FaqItem[] = [
      { q: "pago con tarjeta", a: "A1" },
      { q: "pago con paypal", a: "A2" },
    ];
    expect(suggestFaqAnswers("pago con", tied, { limit: 1 })).toEqual([
      { q: "pago con paypal", a: "A2", score: 2 },
    ]);
  });

  it("defaults to at most three suggestions", () => {
    const many: readonly FaqItem[] = [
      { q: "hola uno", a: "A1" },
      { q: "hola dos", a: "A2" },
      { q: "hola tres", a: "A3" },
      { q: "hola cuatro", a: "A4" },
    ];
    const result = suggestFaqAnswers("hola", many);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.q)).toEqual([
      "hola cuatro",
      "hola dos",
      "hola tres",
    ]);
  });

  it("returns an empty list for a limit of zero or less", () => {
    expect(suggestFaqAnswers("contraseña", FAQ, { limit: 0 })).toEqual([]);
    expect(suggestFaqAnswers("contraseña", FAQ, { limit: -2 })).toEqual([]);
  });

  it("handles an undefined question", () => {
    expect(suggestFaqAnswers(undefined, FAQ)).toEqual([]);
  });

  it("handles a question with no usable words", () => {
    expect(suggestFaqAnswers("   ¿?  ", FAQ)).toEqual([]);
  });

  it("handles an empty FAQ list", () => {
    expect(suggestFaqAnswers("contraseña", [])).toEqual([]);
  });

  it("is deterministic across repeated calls", () => {
    const first = suggestFaqAnswers("¿Cómo cambio mi saldo?", FAQ);
    const second = suggestFaqAnswers("¿Cómo cambio mi saldo?", FAQ);
    expect(first).toEqual(second);
  });
});
