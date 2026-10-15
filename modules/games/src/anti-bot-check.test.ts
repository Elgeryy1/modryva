import { describe, expect, it } from "vitest";
import { verifyAntiBotChallenge } from "./anti-bot-check.js";

describe("verifyAntiBotChallenge", () => {
  it("accepts a correct answer within the default timing window", () => {
    expect(
      verifyAntiBotChallenge({
        answer: "Casa",
        expected: "casa",
        responseMs: 1500,
      }),
    ).toEqual({ human: true, reason: "Verificación superada. ✅" });
  });

  it("trims and lowercases before comparing", () => {
    expect(
      verifyAntiBotChallenge({
        answer: "  CaSa  ",
        expected: "casa",
        responseMs: 1500,
      }),
    ).toEqual({ human: true, reason: "Verificación superada. ✅" });
  });

  it("rejects an answer that is too fast (scripted)", () => {
    expect(
      verifyAntiBotChallenge({
        answer: "casa",
        expected: "casa",
        responseMs: 100,
      }),
    ).toEqual({
      human: false,
      reason: "Respuesta demasiado rápida, parece automatizada. 🤖",
    });
  });

  it("rejects a wrong answer", () => {
    expect(
      verifyAntiBotChallenge({
        answer: "perro",
        expected: "casa",
        responseMs: 1500,
      }),
    ).toEqual({ human: false, reason: "Respuesta incorrecta. ❌" });
  });

  it("rejects an answer that is too slow (timeout)", () => {
    expect(
      verifyAntiBotChallenge({
        answer: "casa",
        expected: "casa",
        responseMs: 40000,
      }),
    ).toEqual({
      human: false,
      reason: "Tiempo agotado, la respuesta llegó demasiado tarde. ⏰",
    });
  });

  it("prioritizes the too-fast reason over a wrong answer", () => {
    expect(
      verifyAntiBotChallenge({
        answer: "perro",
        expected: "casa",
        responseMs: 50,
      }),
    ).toEqual({
      human: false,
      reason: "Respuesta demasiado rápida, parece automatizada. 🤖",
    });
  });

  it("treats the minMs boundary as valid (inclusive)", () => {
    expect(
      verifyAntiBotChallenge({
        answer: "casa",
        expected: "casa",
        responseMs: 300,
      }),
    ).toEqual({ human: true, reason: "Verificación superada. ✅" });
  });

  it("treats the maxMs boundary as valid (inclusive)", () => {
    expect(
      verifyAntiBotChallenge({
        answer: "casa",
        expected: "casa",
        responseMs: 30000,
      }),
    ).toEqual({ human: true, reason: "Verificación superada. ✅" });
  });

  it("honors custom minMs and maxMs options", () => {
    expect(
      verifyAntiBotChallenge(
        { answer: "casa", expected: "casa", responseMs: 500 },
        { minMs: 1000, maxMs: 5000 },
      ),
    ).toEqual({
      human: false,
      reason: "Respuesta demasiado rápida, parece automatizada. 🤖",
    });
  });

  it("matches empty answer against empty expected", () => {
    expect(
      verifyAntiBotChallenge({ answer: "   ", expected: "", responseMs: 1500 }),
    ).toEqual({ human: true, reason: "Verificación superada. ✅" });
  });

  it("is deterministic for identical inputs", () => {
    const input = { answer: "Sol", expected: "sol", responseMs: 800 } as const;
    expect(verifyAntiBotChallenge(input)).toEqual(
      verifyAntiBotChallenge(input),
    );
  });
});
