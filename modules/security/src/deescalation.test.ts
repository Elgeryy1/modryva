import { describe, expect, it } from "vitest";
import { recommendDeescalation } from "./deescalation.js";

describe("recommendDeescalation", () => {
  it("returns 'ninguna' for a calm conversation", () => {
    expect(recommendDeescalation({ tension: 0, messagesPerMin: 0 })).toEqual({
      action: "ninguna",
      message:
        "✅ La conversación fluye con normalidad. No se requiere ninguna acción.",
    });
  });

  it("suggests a pause when tension is moderate", () => {
    const advice = recommendDeescalation({ tension: 0.4, messagesPerMin: 2 });
    expect(advice.action).toBe("sugerir_pausa");
    expect(advice.message).toContain("¿Qué tal una pausa");
  });

  it("suggests a pause when the rate alone crosses the low threshold", () => {
    expect(
      recommendDeescalation({ tension: 0.2, messagesPerMin: 10 }).action,
    ).toBe("sugerir_pausa");
  });

  it("slows down when tension is high but rate is not extreme", () => {
    expect(
      recommendDeescalation({ tension: 0.7, messagesPerMin: 5 }).action,
    ).toBe("ralentizar");
  });

  it("slows down when the rate is high but tension is low", () => {
    expect(
      recommendDeescalation({ tension: 0.2, messagesPerMin: 16 }).action,
    ).toBe("ralentizar");
  });

  it("cools down only when both tension and rate are extreme", () => {
    expect(
      recommendDeescalation({ tension: 0.9, messagesPerMin: 25 }).action,
    ).toBe("enfriar");
  });

  it("does not cool down when tension is high but rate is low", () => {
    expect(
      recommendDeescalation({ tension: 0.85, messagesPerMin: 10 }).action,
    ).toBe("ralentizar");
  });

  it("clamps out-of-range values before deciding", () => {
    expect(
      recommendDeescalation({ tension: 5, messagesPerMin: 100 }).action,
    ).toBe("enfriar");
  });

  it("treats negative signals as neutral", () => {
    expect(
      recommendDeescalation({ tension: -3, messagesPerMin: -5 }).action,
    ).toBe("ninguna");
  });

  it("treats non-finite signals as neutral", () => {
    expect(
      recommendDeescalation({ tension: Number.NaN, messagesPerMin: Number.NaN })
        .action,
    ).toBe("ninguna");
  });

  it("honors the exact lower boundaries", () => {
    expect(
      recommendDeescalation({ tension: 0.35, messagesPerMin: 0 }).action,
    ).toBe("sugerir_pausa");
    expect(
      recommendDeescalation({ tension: 0, messagesPerMin: 8 }).action,
    ).toBe("sugerir_pausa");
  });

  it("is deterministic for repeated identical inputs", () => {
    const input = { tension: 0.62, messagesPerMin: 12 };
    expect(recommendDeescalation(input)).toEqual(recommendDeescalation(input));
    expect(recommendDeescalation(input).action).toBe("ralentizar");
  });
});
