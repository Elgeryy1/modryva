import { describe, expect, it } from "vitest";
import { checkReviveSilence } from "./revive-silence.js";

const FIRST_ICEBREAKER =
  "El grupo esta muy callado 🤔 ¿Cual ha sido lo mejor de vuestro dia?";
const SECOND_ICEBREAKER =
  "¡Silencio total por aqui! 🎉 Si fueras un emoji ahora mismo, ¿cual serias?";
const THIRD_ICEBREAKER =
  "Se nota tranquilo el chat 😴 ¿Alguien recomienda una serie o pelicula para esta noche?";

describe("checkReviveSilence", () => {
  it("does not revive below the default threshold", () => {
    expect(checkReviveSilence({ minutesSinceLastMessage: 90 })).toEqual({
      revive: false,
      prompt: "",
    });
  });

  it("does not revive just below the threshold boundary", () => {
    expect(checkReviveSilence({ minutesSinceLastMessage: 119 })).toEqual({
      revive: false,
      prompt: "",
    });
  });

  it("revives exactly at the default threshold with the first icebreaker", () => {
    expect(checkReviveSilence({ minutesSinceLastMessage: 120 })).toEqual({
      revive: true,
      prompt: FIRST_ICEBREAKER,
    });
  });

  it("escalates the icebreaker as silence grows", () => {
    expect(checkReviveSilence({ minutesSinceLastMessage: 240 }).prompt).toBe(
      SECOND_ICEBREAKER,
    );
    expect(checkReviveSilence({ minutesSinceLastMessage: 600 }).prompt).toBe(
      THIRD_ICEBREAKER,
    );
  });

  it("honors a custom quietThresholdMin option", () => {
    expect(
      checkReviveSilence(
        { minutesSinceLastMessage: 45 },
        { quietThresholdMin: 30 },
      ),
    ).toEqual({ revive: true, prompt: FIRST_ICEBREAKER });
    expect(
      checkReviveSilence(
        { minutesSinceLastMessage: 20 },
        { quietThresholdMin: 30 },
      ),
    ).toEqual({ revive: false, prompt: "" });
  });

  it("falls back to the default threshold for invalid options", () => {
    expect(
      checkReviveSilence(
        { minutesSinceLastMessage: 120 },
        { quietThresholdMin: 0 },
      ),
    ).toEqual({ revive: true, prompt: FIRST_ICEBREAKER });
    expect(
      checkReviveSilence(
        { minutesSinceLastMessage: 100 },
        { quietThresholdMin: -50 },
      ),
    ).toEqual({ revive: false, prompt: "" });
  });

  it("treats zero minutes as active", () => {
    expect(checkReviveSilence({ minutesSinceLastMessage: 0 })).toEqual({
      revive: false,
      prompt: "",
    });
  });

  it("treats negative minutes safely", () => {
    expect(checkReviveSilence({ minutesSinceLastMessage: -30 })).toEqual({
      revive: false,
      prompt: "",
    });
  });

  it("treats non-finite minutes safely", () => {
    expect(checkReviveSilence({ minutesSinceLastMessage: Number.NaN })).toEqual(
      {
        revive: false,
        prompt: "",
      },
    );
    expect(
      checkReviveSilence({ minutesSinceLastMessage: Number.POSITIVE_INFINITY }),
    ).toEqual({ revive: false, prompt: "" });
  });

  it("is deterministic for repeated identical calls", () => {
    const first = checkReviveSilence({ minutesSinceLastMessage: 300 });
    const second = checkReviveSilence({ minutesSinceLastMessage: 300 });
    expect(first).toEqual(second);
  });
});
