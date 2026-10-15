import { describe, expect, it } from "vitest";

import { bonoDeCasino } from "./en-el-casino.js";

describe("el bono de la mascota en el casino", () => {
  it("el pato pone fichas de mas sobre lo ganado", () => {
    // 1.15 sobre una ganancia neta de 1000 son 150 de propina.
    expect(bonoDeCasino("pato", 1000)).toBe(150);
  });

  it("solo sobre la ganancia NETA, nunca sobre el pago entero", () => {
    // Sobre el pago, un bono devolveria parte de lo apostado incluso en manos
    // perdedoras, y eso convierte un bono pequeño en no perder nunca.
    expect(bonoDeCasino("pato", 0)).toBe(0);
    expect(bonoDeCasino("pato", -500)).toBe(0);
  });

  it("redondea hacia abajo, que es lo que evita la impresora", () => {
    // 15% de 1 es 0.15. Hacia arriba serian fichas gratis por cada apuesta
    // minima ganada: pequeño, constante y dificil de ver.
    expect(bonoDeCasino("pato", 1)).toBe(0);
    expect(bonoDeCasino("pato", 6)).toBe(0);
    expect(bonoDeCasino("pato", 7)).toBe(1);
  });

  it("una especie sin el efecto no pone nada", () => {
    expect(bonoDeCasino("gato", 1000)).toBe(0);
    expect(bonoDeCasino("zorro", 1000)).toBe(0);
  });

  it("quien no tiene bicho juega como siempre", () => {
    expect(bonoDeCasino(null, 1000)).toBe(0);
    expect(bonoDeCasino(undefined, 1000)).toBe(0);
    expect(bonoDeCasino("especie-retirada", 1000)).toBe(0);
  });

  it("una ganancia corrupta no inventa fichas", () => {
    expect(bonoDeCasino("pato", Number.NaN)).toBe(0);
    expect(bonoDeCasino("pato", Number.POSITIVE_INFINITY)).toBe(0);
  });
});
