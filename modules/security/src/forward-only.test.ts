import { describe, expect, it } from "vitest";
import {
  detectForwardOnly,
  FORWARD_ONLY_HIGH_RATIO,
  FORWARD_ONLY_LINK_RATIO,
  type ForwardOnlyMessage,
} from "./forward-only.js";

const msg = (isForward: boolean, hasUrl = false): ForwardOnlyMessage => ({
  isForward,
  hasUrl,
});

/** Construye una muestra de `n` mensajes usando un patron por indice. */
const sample = (
  n: number,
  make: (index: number) => ForwardOnlyMessage,
): ForwardOnlyMessage[] => Array.from({ length: n }, (_, i) => make(i));

describe("detectForwardOnly - muestra insuficiente", () => {
  it("no marca ante muestra vacia (seguro ante 0)", () => {
    const result = detectForwardOnly([], 5);
    expect(result).toEqual({
      flagged: false,
      forwardRatio: 0,
      reason: "Muestra insuficiente para evaluar reenvios.",
    });
  });

  it("no marca cuando hay menos mensajes que el minimo", () => {
    const recent = sample(3, () => msg(true, true));
    const result = detectForwardOnly(recent, 5);
    expect(result.flagged).toBe(false);
    expect(result.forwardRatio).toBe(0);
  });

  it("evalua cuando el total iguala el minimo", () => {
    const recent = sample(4, () => msg(true, false));
    const result = detectForwardOnly(recent, 4);
    expect(result.flagged).toBe(true);
    expect(result.forwardRatio).toBe(1);
  });

  it("con minMessages 0 y muestra vacia sigue siendo seguro", () => {
    expect(detectForwardOnly([], 0).flagged).toBe(false);
  });

  it("con minMessages negativo trata la muestra vacia como insuficiente", () => {
    expect(detectForwardOnly([], -3).forwardRatio).toBe(0);
  });
});

describe("detectForwardOnly - proporcion alta sin enlaces", () => {
  it("marca cuando todo son reenvios sin enlaces", () => {
    const recent = sample(10, () => msg(true, false));
    const result = detectForwardOnly(recent, 5);
    expect(result.flagged).toBe(true);
    expect(result.forwardRatio).toBe(1);
    expect(result.reason).toContain("Perfil de solo-reenvios:");
    expect(result.reason).toContain("100%");
  });

  it("marca justo en el umbral alto sin enlaces", () => {
    // 8 de 10 = 0.8 == FORWARD_ONLY_HIGH_RATIO
    const recent = sample(10, (i) => msg(i < 8, false));
    const result = detectForwardOnly(recent, 5);
    expect(result.forwardRatio).toBe(FORWARD_ONLY_HIGH_RATIO);
    expect(result.flagged).toBe(true);
  });

  it("no marca justo por debajo del umbral alto sin enlaces", () => {
    // 7 de 10 = 0.7 < 0.8 y sin enlaces => no supera umbral con links
    const recent = sample(10, (i) => msg(i < 7, false));
    const result = detectForwardOnly(recent, 5);
    expect(result.forwardRatio).toBeCloseTo(0.7, 10);
    expect(result.flagged).toBe(false);
    expect(result.reason).toContain("Actividad normal");
  });
});

describe("detectForwardOnly - reenvios con enlaces", () => {
  it("marca con proporcion media cuando los reenvios llevan enlaces", () => {
    // 7 de 10 reenvios (0.7 >= LINK_RATIO 0.6), todos con enlace
    const recent = sample(10, (i) => msg(i < 7, i < 7));
    const result = detectForwardOnly(recent, 5);
    expect(result.forwardRatio).toBeCloseTo(0.7, 10);
    expect(result.flagged).toBe(true);
    expect(result.reason).toContain("enlaces externos");
  });

  it("marca justo en el umbral con enlaces", () => {
    // 6 de 10 = 0.6 == FORWARD_ONLY_LINK_RATIO, todos con enlace
    const recent = sample(10, (i) => msg(i < 6, i < 6));
    const result = detectForwardOnly(recent, 5);
    expect(result.forwardRatio).toBe(FORWARD_ONLY_LINK_RATIO);
    expect(result.flagged).toBe(true);
  });

  it("no marca si pocos reenvios llevan enlace (share bajo)", () => {
    // 7 de 10 reenvios pero solo 1 con enlace => share 1/7 < 0.5
    const recent = sample(10, (i) => msg(i < 7, i < 1));
    const result = detectForwardOnly(recent, 5);
    expect(result.forwardRatio).toBeCloseTo(0.7, 10);
    expect(result.flagged).toBe(false);
  });

  it("no marca con enlaces si la proporcion de reenvios es baja", () => {
    // 5 de 10 = 0.5 < LINK_RATIO 0.6, aun con enlaces
    const recent = sample(10, (i) => msg(i < 5, i < 5));
    const result = detectForwardOnly(recent, 5);
    expect(result.flagged).toBe(false);
  });

  it("el umbral con enlaces es mas bajo que el umbral alto", () => {
    expect(FORWARD_ONLY_LINK_RATIO).toBeLessThan(FORWARD_ONLY_HIGH_RATIO);
  });
});

describe("detectForwardOnly - contenido propio", () => {
  it("no marca a un usuario que escribe contenido propio", () => {
    const recent = sample(10, (i) => msg(i < 2, i < 2));
    const result = detectForwardOnly(recent, 5);
    expect(result.flagged).toBe(false);
    expect(result.reason).toContain("Actividad normal");
    expect(result.reason).toContain("20%");
  });

  it("no marca cuando no hay reenvios", () => {
    const recent = sample(8, () => msg(false, true));
    const result = detectForwardOnly(recent, 5);
    expect(result.forwardRatio).toBe(0);
    expect(result.flagged).toBe(false);
  });
});

describe("detectForwardOnly - forma y determinismo", () => {
  it("forwardRatio siempre queda en [0, 1]", () => {
    const recent = sample(12, (i) => msg(i % 3 === 0, i % 2 === 0));
    const result = detectForwardOnly(recent, 5);
    expect(result.forwardRatio).toBeGreaterThanOrEqual(0);
    expect(result.forwardRatio).toBeLessThanOrEqual(1);
  });

  it("es determinista ante entradas identicas", () => {
    const recent = sample(9, (i) => msg(i < 8, i < 4));
    expect(detectForwardOnly(recent, 5)).toEqual(detectForwardOnly(recent, 5));
  });

  it("no muta la muestra de entrada", () => {
    const recent = sample(6, () => msg(true, true));
    const copy = recent.map((m) => ({ ...m }));
    detectForwardOnly(recent, 3);
    expect(recent).toEqual(copy);
  });

  it("siempre devuelve las tres claves esperadas", () => {
    const result = detectForwardOnly([msg(true, true)], 1);
    expect(Object.keys(result).sort()).toEqual([
      "flagged",
      "forwardRatio",
      "reason",
    ]);
  });
});
