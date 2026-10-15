import { describe, expect, it } from "vitest";

import { ESPECIES, type EspecieId } from "./especies.js";
import { SIN_VENTAJAS, ventajasDe, ventajasDeEspecie } from "./ventajas.js";

/** Las clases cuya ventaja la cobra `rendimiento.ts` y no este fichero. */
const CLASES_DE_RENTA = new Set([
  "renta",
  "rentaAlAzar",
  "rentaAcumulada",
  "rentaColectiva",
  "rentaPorHorario",
  "rentaIndiferente",
  "rentaPorBuenClima",
  "bonusDeClan",
  "bonusPorNovato",
  "copiaVecino",
  "legendaria",
]);

const ids = Object.keys(ESPECIES) as EspecieId[];

describe("las ventajas de una especie", () => {
  it("toda especie que no vive de la renta aporta algo de verdad", () => {
    // ESTE es el test que faltaba. Quince clases de efecto estaban declaradas
    // en el catalogo, salian escritas en la ficha y no hacian absolutamente
    // nada en ningun sistema: `rendimiento.ts` las despachaba con `factor: 1`
    // y nadie mas les preguntaba. Una especie cuyo efecto no se traduce en un
    // solo numero es una promesa rota, y ahora eso falla.
    const mudas = ids.filter((id) => {
      if (CLASES_DE_RENTA.has(ESPECIES[id].efecto.clase)) {
        return false;
      }
      return (
        JSON.stringify(ventajasDeEspecie(id)) === JSON.stringify(SIN_VENTAJAS)
      );
    });
    expect(mudas).toEqual([]);
  });

  it("las de renta no cobran dos veces", () => {
    // Su bono ya lo aplica `rendimiento.ts`. Sumarlo tambien aqui seria
    // pagarlo dos veces, y en el unico fichero que acuña moneda.
    for (const id of ids) {
      if (CLASES_DE_RENTA.has(ESPECIES[id].efecto.clase)) {
        expect(ventajasDeEspecie(id)).toEqual(SIN_VENTAJAS);
      }
    }
  });

  it("quien no tiene bicho no cambia nada de nada", () => {
    expect(ventajasDe(null)).toEqual(SIN_VENTAJAS);
    expect(ventajasDe(undefined)).toEqual(SIN_VENTAJAS);
    expect(ventajasDe("")).toEqual(SIN_VENTAJAS);
    // El neutro del casino es 1 y no 0: multiplicar por cero dejaria sin
    // premio a todo el que no tenga mascota.
    expect(SIN_VENTAJAS.casino).toBe(1);
  });

  it("una especie retirada del catalogo no rompe a quien la tenga", () => {
    // El catalogo crece por tandas y una tanda retirada dejaria filas
    // apuntando a nada. Perder el bono es molesto; no poder robar, no.
    expect(ventajasDe("bicho-que-ya-no-existe")).toEqual(SIN_VENTAJAS);
  });

  it("la tortuga protege de los robos, que es lo que promete su ficha", () => {
    const tortuga = ventajasDeEspecie("tortuga");
    expect(tortuga.robo.bloqueaRobo).toBeGreaterThan(0);
    expect(tortuga.robo.botinMas).toBe(0);
  });

  it("el zorro roba mejor y no se protege a si mismo", () => {
    const zorro = ventajasDeEspecie("zorro");
    expect(zorro.robo.botinMas).toBeGreaterThan(0);
    expect(zorro.robo.esperaMenos).toBeGreaterThan(0);
    expect(zorro.robo.bloqueaRobo).toBe(0);
  });

  it("las probabilidades salen acotadas a [0,1] pase lo que pase", () => {
    // Vienen de un catalogo escrito a mano: un 20 en vez de un 0.2 daria una
    // probabilidad del dos mil por ciento, y eso no se ve hasta que alguien
    // no puede robarle a nadie.
    for (const id of ids) {
      const { robo, juegos } = ventajasDeEspecie(id);
      for (const p of [
        robo.bloqueaRobo,
        robo.protegeAOtro,
        robo.robaObjetos,
        robo.ahorraObjeto,
        robo.recuperaRobado,
        robo.esperaMenos,
        juegos.menosEspera,
        juegos.castigoAlRetador,
      ]) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
    }
  });

  it("los contadores de juego son enteros y nunca negativos", () => {
    for (const id of ids) {
      const { juegos } = ventajasDeEspecie(id);
      for (const n of [
        juegos.energiaExtra,
        juegos.puntosDeIngenio,
        juegos.puntosDeMemoria,
        juegos.segundasOportunidades,
      ]) {
        expect(Number.isInteger(n)).toBe(true);
        expect(n).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
