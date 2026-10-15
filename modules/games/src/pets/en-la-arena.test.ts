import { describe, expect, it } from "vitest";

import { ganadorConMascotas, ganaLosEmpates } from "./en-la-arena.js";

describe("el gato negro en el duelo", () => {
  it("se queda con los empates", () => {
    expect(ganadorConMascotas({ winner: 0, deQuienReta: "gatonegro" })).toBe(1);
    expect(ganadorConMascotas({ winner: 0, deQuienAcepta: "gatonegro" })).toBe(
      2,
    );
  });

  it("NUNCA cambia un resultado que ya decidieron los dados", () => {
    // Lo que mantiene el duelo legible: quien saca el numero mas alto gana,
    // siempre. Y es lo unico posible — las tiradas las hace Telegram y la
    // gente ha visto rodar el dado.
    expect(ganadorConMascotas({ winner: 1, deQuienAcepta: "gatonegro" })).toBe(
      1,
    );
    expect(ganadorConMascotas({ winner: 2, deQuienReta: "gatonegro" })).toBe(2);
  });

  it("con gato negro en los dos lados el empate se queda empate", () => {
    // La ventaja se anula sola. Cualquier otra respuesta premiaria a uno de
    // los dos por orden de llegada.
    expect(
      ganadorConMascotas({
        winner: 0,
        deQuienReta: "gatonegro",
        deQuienAcepta: "gatonegro",
      }),
    ).toBe(0);
  });

  it("sin bichos, el empate sigue siendo empate", () => {
    expect(ganadorConMascotas({ winner: 0 })).toBe(0);
    expect(
      ganadorConMascotas({
        winner: 0,
        deQuienReta: null,
        deQuienAcepta: null,
      }),
    ).toBe(0);
  });

  it("otras especies no tocan el duelo", () => {
    expect(
      ganadorConMascotas({
        winner: 0,
        deQuienReta: "zorro",
        deQuienAcepta: "dragon",
      }),
    ).toBe(0);
    expect(ganaLosEmpates("gato")).toBe(false);
    expect(ganaLosEmpates(null)).toBe(false);
    expect(ganaLosEmpates("especie-retirada")).toBe(false);
  });

  it("la ventaja vale menos que su efecto declarado, no mas", () => {
    // El empate cae 1 de cada 6, o sea 0.167, y el efecto declara 0.2. Se
    // queda corto a proposito: pasarse con una especie rara del casino se paga
    // en fichas de todo el mundo.
    const empatesDeSeisCaras = 1 / 6;
    expect(empatesDeSeisCaras).toBeLessThan(0.2);
  });
});
