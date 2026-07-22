import { describe, expect, it } from "vitest";
import { shouldCloseTopic } from "./topic-close.js";

describe("shouldCloseTopic", () => {
  it("closes when heat alone reaches the default threshold", () => {
    expect(shouldCloseTopic({ heat: 10, messagesPerMin: 5 })).toEqual({
      close: true,
      reason: "🔒 El hilo está demasiado caldeado. Se cierra temporalmente.",
    });
  });

  it("closes when message rate alone reaches the default threshold", () => {
    expect(shouldCloseTopic({ heat: 2, messagesPerMin: 40 })).toEqual({
      close: true,
      reason:
        "🔒 El hilo recibe demasiados mensajes por minuto. Se cierra temporalmente.",
    });
  });

  it("closes with combined reason when both signals fire", () => {
    expect(shouldCloseTopic({ heat: 9, messagesPerMin: 35 })).toEqual({
      close: true,
      reason:
        "🔒 El hilo se descontroló: temperatura y ritmo de mensajes superan el límite. Se cierra temporalmente.",
    });
  });

  it("keeps the topic open when both signals are calm", () => {
    expect(shouldCloseTopic({ heat: 3, messagesPerMin: 10 })).toEqual({
      close: false,
      reason: "✅ El hilo está tranquilo; no hace falta cerrarlo.",
    });
  });

  it("treats the default heat threshold as inclusive", () => {
    expect(shouldCloseTopic({ heat: 8, messagesPerMin: 0 })).toEqual({
      close: true,
      reason: "🔒 El hilo está demasiado caldeado. Se cierra temporalmente.",
    });
  });

  it("treats the default rate threshold as inclusive", () => {
    expect(shouldCloseTopic({ heat: 0, messagesPerMin: 30 })).toEqual({
      close: true,
      reason:
        "🔒 El hilo recibe demasiados mensajes por minuto. Se cierra temporalmente.",
    });
  });

  it("does not close one unit below both default thresholds", () => {
    expect(shouldCloseTopic({ heat: 7, messagesPerMin: 29 }).close).toBe(false);
  });

  it("honors a custom heat threshold", () => {
    expect(
      shouldCloseTopic({ heat: 6, messagesPerMin: 0 }, { heatThreshold: 5 }),
    ).toEqual({
      close: true,
      reason: "🔒 El hilo está demasiado caldeado. Se cierra temporalmente.",
    });
  });

  it("honors a custom rate threshold", () => {
    expect(
      shouldCloseTopic({ heat: 0, messagesPerMin: 12 }, { rateThreshold: 10 })
        .close,
    ).toBe(true);
  });

  it("ignores unrelated option fields and falls back to defaults", () => {
    expect(
      shouldCloseTopic({ heat: 7, messagesPerMin: 29 }, { heatThreshold: 8 })
        .close,
    ).toBe(false);
  });

  it("is deterministic for repeated identical calls", () => {
    const input = { heat: 9, messagesPerMin: 35 } as const;
    expect(shouldCloseTopic(input)).toEqual(shouldCloseTopic(input));
  });
});
