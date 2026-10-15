import { describe, expect, it } from "vitest";

import { debeBorrarPorCaracteres, debeBorrarPorModoNoche } from "./higiene.js";

/**
 * El modo noche borra mensajes de gente, asi que su franja horaria merece
 * tests propios — y sobre todo el caso que mas se equivoca a mano: la franja
 * que cruza la medianoche.
 */
describe("debeBorrarPorModoNoche", () => {
  it("con el modo apagado no borra nunca, sea la hora que sea", () => {
    expect(
      debeBorrarPorModoNoche({
        modoNocheActivo: false,
        hora: 3,
        horaInicio: 23,
        horaFin: 7,
      }),
    ).toBe(false);
  });

  it("dentro de una franja que cruza la medianoche, si borra", () => {
    for (const hora of [23, 0, 3, 6]) {
      expect(
        debeBorrarPorModoNoche({
          modoNocheActivo: true,
          hora,
          horaInicio: 23,
          horaFin: 7,
        }),
      ).toBe(true);
    }
  });

  it("fuera de esa franja no borra", () => {
    for (const hora of [7, 12, 18, 22]) {
      expect(
        debeBorrarPorModoNoche({
          modoNocheActivo: true,
          hora,
          horaInicio: 23,
          horaFin: 7,
        }),
      ).toBe(false);
    }
  });

  it("una franja normal, sin cruzar medianoche, tambien funciona", () => {
    expect(
      debeBorrarPorModoNoche({
        modoNocheActivo: true,
        hora: 15,
        horaInicio: 14,
        horaFin: 16,
      }),
    ).toBe(true);
    expect(
      debeBorrarPorModoNoche({
        modoNocheActivo: true,
        hora: 17,
        horaInicio: 14,
        horaFin: 16,
      }),
    ).toBe(false);
  });
});

describe("debeBorrarPorCaracteres", () => {
  it("con los dos filtros apagados no mira siquiera el texto", () => {
    expect(
      debeBorrarPorCaracteres({
        texto: "مرحبا 你好",
        filtroRtl: false,
        filtroCjk: false,
      }),
    ).toBe(false);
  });

  it("un texto latino normal no cae con ningun filtro", () => {
    expect(
      debeBorrarPorCaracteres({
        texto: "buenos dias a todos",
        filtroRtl: true,
        filtroCjk: true,
      }),
    ).toBe(false);
  });

  it("los dos filtros son independientes", () => {
    // Encender el de CJK no debe empezar a borrar arabe, ni al reves: responden
    // a problemas distintos y un grupo puede querer solo uno.
    const soloCjk = debeBorrarPorCaracteres({
      texto: "你好世界 这是一条消息",
      filtroRtl: false,
      filtroCjk: true,
    });
    const soloRtlSobreCjk = debeBorrarPorCaracteres({
      texto: "你好世界 这是一条消息",
      filtroRtl: true,
      filtroCjk: false,
    });
    expect(soloCjk).toBe(true);
    expect(soloRtlSobreCjk).toBe(false);
  });
});
