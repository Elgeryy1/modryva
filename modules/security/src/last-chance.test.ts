import { describe, expect, it } from "vitest";
import { decideLastChance } from "./last-chance.js";

describe("decideLastChance", () => {
  it("warns when well below the threshold", () => {
    expect(decideLastChance({ warnCount: 0, threshold: 3 })).toEqual({
      action: "avisar",
      message: "⚠️ Llevas 0 de 3 avisos. Te quedan 3 antes de la expulsión.",
    });
  });

  it("keeps warning just under the last-chance boundary", () => {
    expect(decideLastChance({ warnCount: 1, threshold: 3 })).toEqual({
      action: "avisar",
      message: "⚠️ Llevas 1 de 3 avisos. Te quedan 2 antes de la expulsión.",
    });
  });

  it("gives a final warning at threshold minus one", () => {
    expect(decideLastChance({ warnCount: 2, threshold: 3 })).toEqual({
      action: "ultima_oportunidad",
      message:
        "🚨 Última oportunidad: llevas 2 de 3 avisos. Un aviso más y serás expulsado.",
    });
  });

  it("bans exactly at the threshold", () => {
    expect(decideLastChance({ warnCount: 3, threshold: 3 })).toEqual({
      action: "banear",
      message:
        "⛔ Has alcanzado el límite de 3 avisos. Procede la expulsión del grupo.",
    });
  });

  it("bans when the warn count exceeds the threshold", () => {
    expect(decideLastChance({ warnCount: 7, threshold: 3 })).toEqual({
      action: "banear",
      message:
        "⛔ Has alcanzado el límite de 3 avisos. Procede la expulsión del grupo.",
    });
  });

  it("treats a threshold below one as one", () => {
    expect(decideLastChance({ warnCount: 0, threshold: 0 })).toEqual({
      action: "ultima_oportunidad",
      message:
        "🚨 Última oportunidad: llevas 0 de 1 avisos. Un aviso más y serás expulsado.",
    });
  });

  it("clamps negative warn counts to zero", () => {
    expect(decideLastChance({ warnCount: -5, threshold: 3 })).toEqual({
      action: "avisar",
      message: "⚠️ Llevas 0 de 3 avisos. Te quedan 3 antes de la expulsión.",
    });
  });

  it("floors non-integer inputs before deciding", () => {
    expect(decideLastChance({ warnCount: 2.9, threshold: 3.4 })).toEqual({
      action: "ultima_oportunidad",
      message:
        "🚨 Última oportunidad: llevas 2 de 3 avisos. Un aviso más y serás expulsado.",
    });
  });

  it("falls back to safe defaults for non-finite inputs", () => {
    expect(
      decideLastChance({
        warnCount: Number.NaN,
        threshold: Number.POSITIVE_INFINITY,
      }),
    ).toEqual({
      action: "ultima_oportunidad",
      message:
        "🚨 Última oportunidad: llevas 0 de 1 avisos. Un aviso más y serás expulsado.",
    });
  });

  it("is deterministic across repeated calls with the same input", () => {
    const input = { warnCount: 4, threshold: 6 } as const;
    const first = decideLastChance(input);
    const second = decideLastChance(input);
    expect(first).toEqual(second);
    expect(first).toEqual({
      action: "avisar",
      message: "⚠️ Llevas 4 de 6 avisos. Te quedan 2 antes de la expulsión.",
    });
  });
});
