import { describe, expect, it } from "vitest";
import { buildSanctionRationale } from "./explain-before-sanction.js";

describe("buildSanctionRationale", () => {
  it("explains rule and action with multiple priors and high confidence", () => {
    expect(
      buildSanctionRationale({
        rule: "spam",
        action: "silenciar",
        priorWarns: 2,
        confidence: 0.9,
      }),
    ).toBe(
      '📋 Motivo: se infringió la regla "spam".\n' +
        "⚖️ Propongo silenciar: 2 avisos previos y confianza alta (90%).",
    );
  });

  it("uses singular phrasing for exactly one prior warning", () => {
    expect(
      buildSanctionRationale({
        rule: "flood",
        action: "expulsar",
        priorWarns: 1,
        confidence: 0.6,
      }),
    ).toBe(
      '📋 Motivo: se infringió la regla "flood".\n' +
        "⚖️ Propongo expulsar: 1 aviso previo y confianza media (60%).",
    );
  });

  it("says 'sin avisos previos' when there are no priors", () => {
    expect(
      buildSanctionRationale({
        rule: "enlaces",
        action: "advertir",
        priorWarns: 0,
        confidence: 0.4,
      }),
    ).toBe(
      '📋 Motivo: se infringió la regla "enlaces".\n' +
        "⚖️ Propongo advertir: sin avisos previos y confianza baja (40%).",
    );
  });

  it("falls back to generic labels when rule and action are blank", () => {
    expect(
      buildSanctionRationale({
        rule: "   ",
        action: "",
        priorWarns: 0,
        confidence: 0,
      }),
    ).toBe(
      '📋 Motivo: se infringió la regla "una norma del grupo".\n' +
        "⚖️ Propongo revisar el caso: sin avisos previos y confianza baja (0%).",
    );
  });

  it("treats 0.8 and 0.5 as inclusive confidence boundaries", () => {
    const high = buildSanctionRationale({
      rule: "r",
      action: "a",
      priorWarns: 0,
      confidence: 0.8,
    });
    const mid = buildSanctionRationale({
      rule: "r",
      action: "a",
      priorWarns: 0,
      confidence: 0.5,
    });
    expect(high).toContain("confianza alta (80%)");
    expect(mid).toContain("confianza media (50%)");
  });

  it("clamps confidence above 1 to 100 percent and level alta", () => {
    expect(
      buildSanctionRationale({
        rule: "abuso",
        action: "banear",
        priorWarns: 3,
        confidence: 1.7,
      }),
    ).toBe(
      '📋 Motivo: se infringió la regla "abuso".\n' +
        "⚖️ Propongo banear: 3 avisos previos y confianza alta (100%).",
    );
  });

  it("clamps negative and non-finite confidence to 0 percent", () => {
    const negative = buildSanctionRationale({
      rule: "r",
      action: "a",
      priorWarns: 0,
      confidence: -0.5,
    });
    const nan = buildSanctionRationale({
      rule: "r",
      action: "a",
      priorWarns: 0,
      confidence: Number.NaN,
    });
    expect(negative).toContain("confianza baja (0%)");
    expect(nan).toContain("confianza baja (0%)");
  });

  it("treats negative prior warnings as none", () => {
    expect(
      buildSanctionRationale({
        rule: "r",
        action: "a",
        priorWarns: -4,
        confidence: 0.5,
      }),
    ).toContain("sin avisos previos");
  });

  it("floors fractional prior warnings", () => {
    expect(
      buildSanctionRationale({
        rule: "r",
        action: "a",
        priorWarns: 3.9,
        confidence: 0.5,
      }),
    ).toContain("3 avisos previos");
  });

  it("rounds the confidence percentage to the nearest integer", () => {
    expect(
      buildSanctionRationale({
        rule: "r",
        action: "a",
        priorWarns: 0,
        confidence: 0.855,
      }),
    ).toContain("(86%)");
  });

  it("is deterministic and yields exactly two newline-separated lines", () => {
    const input = {
      rule: "spam",
      action: "silenciar",
      priorWarns: 2,
      confidence: 0.9,
    } as const;
    const first = buildSanctionRationale(input);
    const second = buildSanctionRationale(input);
    expect(first).toBe(second);
    expect(first.split("\n")).toHaveLength(2);
  });
});
