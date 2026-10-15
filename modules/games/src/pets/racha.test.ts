import { describe, expect, it } from "vitest";
import {
  diaSiguiente,
  esHitoDeRacha,
  HITOS_DE_RACHA,
  rachaTrasCerrar,
} from "./racha.js";

describe("diaSiguiente", () => {
  it("suma un dia", () => {
    expect(diaSiguiente("2026-08-29")).toBe("2026-08-30");
  });

  it("cruza el fin de mes y el fin de año", () => {
    expect(diaSiguiente("2026-08-31")).toBe("2026-09-01");
    expect(diaSiguiente("2026-12-31")).toBe("2027-01-01");
  });

  it("acierta con el 29 de febrero de un bisiesto", () => {
    expect(diaSiguiente("2028-02-28")).toBe("2028-02-29");
    expect(diaSiguiente("2028-02-29")).toBe("2028-03-01");
  });

  it("y con el 28 de febrero de uno que no lo es", () => {
    expect(diaSiguiente("2026-02-28")).toBe("2026-03-01");
  });

  it("una fecha ilegible se devuelve tal cual, sin romper la racha", () => {
    // Devolver algo raro haria que la comparacion fallara y la racha se
    // reiniciara sin motivo. Devolverla igual la rompe una vez y ya esta.
    expect(diaSiguiente("no-es-una-fecha")).toBe("no-es-una-fecha");
  });
});

describe("rachaTrasCerrar", () => {
  const base = {
    racha: 5,
    ultimoDiaCerrado: "2026-08-28",
    diaQueSeCierra: "2026-08-29",
    cuidada: true,
  };

  it("dos dias seguidos suman", () => {
    expect(rachaTrasCerrar(base)).toBe(6);
  });

  it("un dia sin cuidar la rompe del todo", () => {
    // Es lo que hace que valga algo: una racha que sobrevive al descuido no
    // mide nada.
    expect(rachaTrasCerrar({ ...base, cuidada: false })).toBe(0);
  });

  it("un hueco la reinicia en uno, no en cero", () => {
    // El dia que se acaba de cerrar YA cuenta.
    expect(rachaTrasCerrar({ ...base, ultimoDiaCerrado: "2026-08-20" })).toBe(
      1,
    );
  });

  it("la primera vez empieza en uno", () => {
    expect(rachaTrasCerrar({ ...base, racha: 0, ultimoDiaCerrado: null })).toBe(
      1,
    );
  });

  it("cerrar el mismo dia dos veces no avanza", () => {
    // No deberia pasar —lo impide `xpDia`— pero repetir no es avanzar.
    expect(rachaTrasCerrar({ ...base, ultimoDiaCerrado: "2026-08-29" })).toBe(
      5,
    );
  });

  it("aguanta un cambio de mes sin cortarse", () => {
    expect(
      rachaTrasCerrar({
        racha: 12,
        ultimoDiaCerrado: "2026-08-31",
        diaQueSeCierra: "2026-09-01",
        cuidada: true,
      }),
    ).toBe(13);
  });

  it("una racha corrupta no contagia el resultado", () => {
    for (const racha of [Number.NaN, -7, Number.POSITIVE_INFINITY]) {
      const salida = rachaTrasCerrar({ ...base, racha });
      expect(Number.isFinite(salida)).toBe(true);
      expect(salida).toBeGreaterThanOrEqual(1);
    }
  });

  it("cuidada false manda sobre todo lo demas", () => {
    expect(
      rachaTrasCerrar({
        racha: 100,
        ultimoDiaCerrado: "2026-08-28",
        diaQueSeCierra: "2026-08-29",
        cuidada: false,
      }),
    ).toBe(0);
  });
});

describe("los hitos", () => {
  it("son pocos y espaciados: felicitar cada dia seria ruido", () => {
    expect(HITOS_DE_RACHA).toEqual([7, 30, 90]);
  });

  it("solo suenan en su numero exacto", () => {
    expect(esHitoDeRacha(7)).toBe(true);
    expect(esHitoDeRacha(30)).toBe(true);
    expect(esHitoDeRacha(6)).toBe(false);
    expect(esHitoDeRacha(8)).toBe(false);
    expect(esHitoDeRacha(0)).toBe(false);
  });
});
