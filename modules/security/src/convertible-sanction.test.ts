import { describe, expect, it } from "vitest";
import { convertSanction } from "./convertible-sanction.js";

describe("convertSanction", () => {
  it("halves the mute by default when the rule is accepted", () => {
    expect(convertSanction({ muteMs: 1000, acceptsRule: true })).toEqual({
      newMuteMs: 500,
      reducedMs: 500,
      message:
        "✅ Gracias por aceptar la norma. Tu sanción baja de 1000 a 500 ms (500 ms menos).",
    });
  });

  it("keeps the mute intact when the rule is not accepted", () => {
    expect(convertSanction({ muteMs: 1000, acceptsRule: false })).toEqual({
      newMuteMs: 1000,
      reducedMs: 0,
      message:
        "⏳ Si aceptas la norma, tu sanción podría reducirse. Por ahora se mantiene en 1000 ms.",
    });
  });

  it("honors a custom reduction ratio", () => {
    expect(
      convertSanction(
        { muteMs: 1000, acceptsRule: true },
        { reductionRatio: 0.25 },
      ),
    ).toEqual({
      newMuteMs: 750,
      reducedMs: 250,
      message:
        "✅ Gracias por aceptar la norma. Tu sanción baja de 1000 a 750 ms (250 ms menos).",
    });
  });

  it("rounds the resulting mute and preserves the total (newMuteMs + reducedMs)", () => {
    const outcome = convertSanction({ muteMs: 999, acceptsRule: true });
    expect(outcome.newMuteMs).toBe(500);
    expect(outcome.reducedMs).toBe(499);
    expect(outcome.newMuteMs + outcome.reducedMs).toBe(999);
  });

  it("clamps a ratio above 1 to a full pardon", () => {
    expect(
      convertSanction(
        { muteMs: 800, acceptsRule: true },
        { reductionRatio: 2 },
      ),
    ).toEqual({
      newMuteMs: 0,
      reducedMs: 800,
      message:
        "✅ Gracias por aceptar la norma. Tu sanción baja de 800 a 0 ms (800 ms menos).",
    });
  });

  it("clamps a negative ratio to no reduction", () => {
    expect(
      convertSanction(
        { muteMs: 800, acceptsRule: true },
        { reductionRatio: -1 },
      ),
    ).toEqual({
      newMuteMs: 800,
      reducedMs: 0,
      message:
        "✅ Gracias por aceptar la norma. Tu sanción baja de 800 a 800 ms (0 ms menos).",
    });
  });

  it("treats a negative mute as zero", () => {
    expect(convertSanction({ muteMs: -500, acceptsRule: true })).toEqual({
      newMuteMs: 0,
      reducedMs: 0,
      message:
        "✅ Gracias por aceptar la norma. Tu sanción baja de 0 a 0 ms (0 ms menos).",
    });
  });

  it("treats a non-finite mute as zero when not accepted", () => {
    expect(convertSanction({ muteMs: Number.NaN, acceptsRule: false })).toEqual(
      {
        newMuteMs: 0,
        reducedMs: 0,
        message:
          "⏳ Si aceptas la norma, tu sanción podría reducirse. Por ahora se mantiene en 0 ms.",
      },
    );
  });

  it("falls back to the default ratio when reductionRatio is undefined", () => {
    const explicitDefault = convertSanction(
      { muteMs: 2000, acceptsRule: true },
      { reductionRatio: 0.5 },
    );
    const implicitDefault = convertSanction({
      muteMs: 2000,
      acceptsRule: true,
    });
    expect(implicitDefault).toEqual(explicitDefault);
  });

  it("is deterministic for repeated identical calls", () => {
    const a = convertSanction(
      { muteMs: 1234, acceptsRule: true },
      { reductionRatio: 0.3 },
    );
    const b = convertSanction(
      { muteMs: 1234, acceptsRule: true },
      { reductionRatio: 0.3 },
    );
    expect(a).toEqual(b);
  });
});
