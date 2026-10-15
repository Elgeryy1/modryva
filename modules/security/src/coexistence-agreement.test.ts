import { describe, expect, it } from "vitest";
import { buildCoexistenceAgreement } from "./coexistence-agreement.js";

describe("buildCoexistenceAgreement", () => {
  it("names both users and lists rules as a bullet list", () => {
    expect(
      buildCoexistenceAgreement({
        userA: "Ana",
        userB: "Beto",
        rules: ["No insultar", "Respetar turnos"],
      }),
    ).toBe(
      "🤝 Acuerdo de convivencia entre Ana y Beto\n\n" +
        "Para seguir participando, ambos aceptan estas reglas mínimas:\n" +
        "• No insultar\n• Respetar turnos\n\n" +
        "Si alguien rompe el acuerdo, la moderación podrá intervenir. 🕊️",
    );
  });

  it("returns a warning when there are no rules", () => {
    expect(
      buildCoexistenceAgreement({ userA: "Ana", userB: "Beto", rules: [] }),
    ).toBe(
      "🤝 Acuerdo de convivencia entre Ana y Beto\n\n" +
        "⚠️ No se definieron reglas mínimas para este acuerdo.",
    );
  });

  it("treats whitespace-only rules as no rules", () => {
    expect(
      buildCoexistenceAgreement({
        userA: "Ana",
        userB: "Beto",
        rules: ["   ", ""],
      }),
    ).toBe(
      "🤝 Acuerdo de convivencia entre Ana y Beto\n\n" +
        "⚠️ No se definieron reglas mínimas para este acuerdo.",
    );
  });

  it("trims each rule and drops blank ones", () => {
    expect(
      buildCoexistenceAgreement({
        userA: "Ana",
        userB: "Beto",
        rules: ["  No spam  ", "", "Sin gritos"],
      }),
    ).toBe(
      "🤝 Acuerdo de convivencia entre Ana y Beto\n\n" +
        "Para seguir participando, ambos aceptan estas reglas mínimas:\n" +
        "• No spam\n• Sin gritos\n\n" +
        "Si alguien rompe el acuerdo, la moderación podrá intervenir. 🕊️",
    );
  });

  it("deduplicates rules preserving first-seen order", () => {
    expect(
      buildCoexistenceAgreement({
        userA: "Ana",
        userB: "Beto",
        rules: ["No spam", "No spam", " No spam ", "Respetar"],
      }),
    ).toBe(
      "🤝 Acuerdo de convivencia entre Ana y Beto\n\n" +
        "Para seguir participando, ambos aceptan estas reglas mínimas:\n" +
        "• No spam\n• Respetar\n\n" +
        "Si alguien rompe el acuerdo, la moderación podrá intervenir. 🕊️",
    );
  });

  it("falls back to placeholders for blank user labels", () => {
    expect(
      buildCoexistenceAgreement({
        userA: "  ",
        userB: "",
        rules: ["No insultar"],
      }),
    ).toBe(
      "🤝 Acuerdo de convivencia entre Usuario A y Usuario B\n\n" +
        "Para seguir participando, ambos aceptan estas reglas mínimas:\n" +
        "• No insultar\n\n" +
        "Si alguien rompe el acuerdo, la moderación podrá intervenir. 🕊️",
    );
  });

  it("preserves user labels verbatim including mentions", () => {
    const message = buildCoexistenceAgreement({
      userA: "@ana",
      userB: "@beto",
      rules: ["No insultar"],
    });
    expect(
      message.startsWith("🤝 Acuerdo de convivencia entre @ana y @beto"),
    ).toBe(true);
  });

  it("is deterministic for repeated identical calls", () => {
    const input = {
      userA: "Ana",
      userB: "Beto",
      rules: ["No insultar", "Respetar turnos"],
    } as const;
    expect(buildCoexistenceAgreement(input)).toBe(
      buildCoexistenceAgreement(input),
    );
  });

  it("does not mutate the input rules array", () => {
    const rules = ["No spam", "No spam", "Respetar"];
    buildCoexistenceAgreement({ userA: "Ana", userB: "Beto", rules });
    expect(rules).toEqual(["No spam", "No spam", "Respetar"]);
  });
});
