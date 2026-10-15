import { describe, expect, it } from "vitest";

import {
  alimentar,
  HAMBRE_POR_RACION,
  PRECIO_BASE_RACION,
  precioDeRacion,
  RACIONES_POR_DIA,
} from "./alimentar.js";
import { ESPECIES_EN_ORDEN } from "./especies.js";
import type { EstadoDeMascota } from "./estado.js";
import { baseDeNivel, rendimientoDelDia, TOPE_DIARIO } from "./rendimiento.js";

const medio: EstadoDeMascota = { hambre: 60, animo: 60, nivel: 3, xp: 0 };
const rico = 1_000_000;

describe("dar de comer", () => {
  it("cobra el precio del grupo y llena lo declarado", () => {
    const salida = alimentar({ estado: medio, saldo: rico, racionesHoy: 0 });
    if (!salida.ok) {
      throw new Error(`deberia haber comido: ${salida.motivo}`);
    }
    expect(salida.coste).toBe(PRECIO_BASE_RACION);
    expect(salida.estado.hambre).toBe(60 + HAMBRE_POR_RACION);
    expect(salida.racionesRestantes).toBe(RACIONES_POR_DIA - 1);
  });

  it("nunca pasa de la barra llena", () => {
    const casiLlena = { ...medio, hambre: 95 };
    const salida = alimentar({
      estado: casiLlena,
      saldo: rico,
      racionesHoy: 0,
    });
    if (!salida.ok) {
      throw new Error("deberia haber comido");
    }
    expect(salida.estado.hambre).toBe(100);
  });

  it("una llena del todo no come: no se le cobra por nada", () => {
    const salida = alimentar({
      estado: { ...medio, hambre: 100 },
      saldo: rico,
      racionesHoy: 0,
    });
    expect(salida.ok).toBe(false);
    expect(salida.ok === false && salida.motivo).toBe("yaLlena");
  });

  it("respeta el tope diario", () => {
    const salida = alimentar({
      estado: medio,
      saldo: rico,
      racionesHoy: RACIONES_POR_DIA,
    });
    expect(salida.ok === false && salida.motivo).toBe("topeDiario");
  });

  it("sin saldo no come, y dice cuanto costaba", () => {
    const salida = alimentar({ estado: medio, saldo: 10, racionesHoy: 0 });
    expect(salida.ok === false && salida.motivo).toBe("sinSaldo");
    expect(salida.coste).toBe(PRECIO_BASE_RACION);
  });

  it("el tope manda sobre el saldo, y la barra llena sobre los dos", () => {
    // El orden de las negativas es el orden en que le importan a quien juega:
    // mandarle a ganar monedas cuando su bicho ya esta lleno seria un mal
    // consejo.
    const sinNada = alimentar({
      estado: { ...medio, hambre: 100 },
      saldo: 0,
      racionesHoy: RACIONES_POR_DIA,
    });
    expect(sinNada.ok === false && sinNada.motivo).toBe("yaLlena");
  });

  it("al gloton le sale mas cara la racion, y al frugal mas barata", () => {
    expect(precioDeRacion(PRECIO_BASE_RACION, ["gloton"])).toBeGreaterThan(
      PRECIO_BASE_RACION,
    );
    expect(precioDeRacion(PRECIO_BASE_RACION, ["frugal"])).toBeLessThan(
      PRECIO_BASE_RACION,
    );
  });

  it("al gloton la racion le llena lo mismo que a los demas", () => {
    // Si le llenara menos, tocaria antes el tope diario y el rasgo seria un
    // castigo encubierto en vez de un intercambio.
    const normal = alimentar({ estado: medio, saldo: rico, racionesHoy: 0 });
    const gloton = alimentar({
      estado: medio,
      saldo: rico,
      racionesHoy: 0,
      rasgos: ["gloton"],
    });
    if (!normal.ok || !gloton.ok) {
      throw new Error("los dos deberian haber comido");
    }
    expect(gloton.estado.hambre).toBe(normal.estado.hambre);
  });

  it("un precio absurdo no rompe el cobro", () => {
    const salida = alimentar({
      estado: medio,
      saldo: rico,
      racionesHoy: 0,
      precioRacion: Number.NaN,
    });
    expect(salida.coste).toBe(0);
  });
});

describe("lo que rinde", () => {
  it("una dormida no acuña nada", () => {
    const salida = rendimientoDelDia({
      especie: "abeja",
      estado: { ...medio, hambre: 0 },
    });
    expect(salida.monedas).toBe(0);
  });

  it("cuanto mejor esta, mas rinde", () => {
    const mal = rendimientoDelDia({
      especie: "abeja",
      estado: { ...medio, hambre: 20, animo: 20 },
    });
    const bien = rendimientoDelDia({
      especie: "abeja",
      estado: { ...medio, hambre: 100, animo: 100 },
    });
    expect(bien.monedas).toBeGreaterThan(mal.monedas);
  });

  it("el hambre pesa mas que el animo", () => {
    const conHambre = rendimientoDelDia({
      especie: "abeja",
      estado: { ...medio, hambre: 20, animo: 100 },
    });
    const desanimada = rendimientoDelDia({
      especie: "abeja",
      estado: { ...medio, hambre: 100, animo: 20 },
    });
    expect(conHambre.monedas).toBeLessThan(desanimada.monedas);
  });

  it("el nivel sube la base", () => {
    expect(baseDeNivel(5)).toBeGreaterThan(baseDeNivel(1));
    expect(baseDeNivel(0)).toBe(baseDeNivel(1));
  });

  it("nunca pasa del tope, por bien que este todo", () => {
    const salida = rendimientoDelDia({
      especie: "abeja",
      estado: { hambre: 100, animo: 100, nivel: 99, xp: 0 },
      rasgos: ["gloton"],
    });
    expect(salida.monedas).toBe(TOPE_DIARIO);
    expect(salida.recortado).toBe(true);
  });

  it("el tope del grupo manda sobre el de referencia", () => {
    const salida = rendimientoDelDia({
      especie: "abeja",
      estado: { hambre: 100, animo: 100, nivel: 50, xp: 0 },
      topeDiario: 100,
    });
    expect(salida.monedas).toBe(100);
  });

  it("la rana da entre nada y el triple segun la tirada", () => {
    const estado = { hambre: 100, animo: 100, nivel: 3, xp: 0 };
    const pesima = rendimientoDelDia({ especie: "rana", estado, tirada: 0 });
    const buenisima = rendimientoDelDia({
      especie: "rana",
      estado,
      tirada: 0.999,
    });
    expect(pesima.monedas).toBe(0);
    expect(buenisima.monedas).toBeGreaterThan(0);
  });

  it("el zorro y la tortuga rinden lo normal: su ventaja esta en otro sitio", () => {
    const estado = { hambre: 80, animo: 80, nivel: 3, xp: 0 };
    const zorro = rendimientoDelDia({ especie: "zorro", estado });
    const tortuga = rendimientoDelDia({ especie: "tortuga", estado });
    const abeja = rendimientoDelDia({ especie: "abeja", estado });
    expect(zorro.monedas).toBe(tortuga.monedas);
    expect(abeja.monedas).toBeGreaterThan(zorro.monedas);
  });

  it("cuidarla bien cuesta mas de lo que devuelve", () => {
    // LA propiedad economica de toda la feature. Si esto se invierte, la
    // mascota deja de ser un sumidero y pasa a ser una impresora.
    const perfecta = rendimientoDelDia({
      especie: "abeja",
      estado: { hambre: 100, animo: 100, nivel: 3, xp: 0 },
    });
    const mantenimiento = 3 * PRECIO_BASE_RACION;
    expect(perfecta.monedas).toBeLessThan(mantenimiento);
  });
});

describe("las especies del catalogo completo", () => {
  const sano = { hambre: 100, animo: 100, nivel: 3, xp: 0 };

  it("la ardilla no rinde nada hasta que le toca, y entonces suelta el pico", () => {
    // Es la mascota de quien entra poco: no pierde nada por no venir cada dia.
    const seco = rendimientoDelDia({
      especie: "ardilla",
      estado: sano,
      contexto: { diaDeLaRacha: 3 },
    });
    const pico = rendimientoDelDia({
      especie: "ardilla",
      estado: sano,
      contexto: { diaDeLaRacha: 5 },
    });
    expect(seco.monedas).toBe(0);
    expect(pico.monedas).toBeGreaterThan(0);
  });

  it("la hormiga rinde mas cuanta mas compañia, con tope", () => {
    const sola = rendimientoDelDia({
      especie: "hormiga",
      estado: sano,
      contexto: { companeras: 0 },
    });
    const acompanada = rendimientoDelDia({
      especie: "hormiga",
      estado: sano,
      contexto: { companeras: 8 },
    });
    const multitud = rendimientoDelDia({
      especie: "hormiga",
      estado: sano,
      contexto: { companeras: 500 },
    });
    expect(acompanada.monedas).toBeGreaterThan(sola.monedas);
    // El tope existe: si no, un grupo grande convertiria la hormiga en una
    // impresora.
    expect(multitud.monedas).toBeLessThan(sola.monedas * 4);
  });

  it("el murcielago rinde de noche y flojea de dia", () => {
    const noche = rendimientoDelDia({
      especie: "murcielago",
      estado: sano,
      contexto: { esDeNoche: true },
    });
    const dia = rendimientoDelDia({
      especie: "murcielago",
      estado: sano,
      contexto: { esDeNoche: false },
    });
    expect(noche.monedas).toBeGreaterThan(dia.monedas * 2);
  });

  it("al gato le da igual el animo, y por eso rinde menos", () => {
    // La mascota para quien no quiere una mascota. Si el animo le afectara,
    // seria una mascota normal peor.
    const contento = rendimientoDelDia({
      especie: "gato",
      estado: { ...sano, animo: 100 },
    });
    const amargado = rendimientoDelDia({
      especie: "gato",
      estado: { ...sano, animo: 0 },
    });
    expect(contento.monedas).toBe(amargado.monedas);
    const abeja = rendimientoDelDia({ especie: "abeja", estado: sano });
    expect(contento.monedas).toBeLessThan(abeja.monedas);
  });

  it("la paloma rinde mas cuanto mas limpia va la semana", () => {
    const sucia = rendimientoDelDia({
      especie: "paloma",
      estado: sano,
      contexto: { diasLimpios: 0 },
    });
    const limpia = rendimientoDelDia({
      especie: "paloma",
      estado: sano,
      contexto: { diasLimpios: 7 },
    });
    expect(limpia.monedas).toBeGreaterThan(sucia.monedas);
  });

  it("la oveja solo rinde de mas con el clan activo", () => {
    const sinClan = rendimientoDelDia({
      especie: "oveja",
      estado: sano,
      contexto: { clanActivo: false },
    });
    const conClan = rendimientoDelDia({
      especie: "oveja",
      estado: sano,
      contexto: { clanActivo: true },
    });
    expect(conClan.monedas).toBeGreaterThan(sinClan.monedas);
  });

  it("el pollito sube con los novatos que se quedan, con techo", () => {
    const solo = rendimientoDelDia({
      especie: "pollito",
      estado: sano,
      contexto: { novatosQueSeQuedan: 0 },
    });
    const conGente = rendimientoDelDia({
      especie: "pollito",
      estado: sano,
      contexto: { novatosQueSeQuedan: 5 },
    });
    const avalancha = rendimientoDelDia({
      especie: "pollito",
      estado: sano,
      contexto: { novatosQueSeQuedan: 200 },
    });
    expect(conGente.monedas).toBeGreaterThan(solo.monedas);
    expect(avalancha.monedas).toBeLessThanOrEqual(solo.monedas * 2);
  });

  it("el camaleon copia al vecino, y sin vecino rinde normal", () => {
    const copiando = rendimientoDelDia({
      especie: "camaleon",
      estado: sano,
      contexto: { factorDelVecino: 1.8 },
    });
    const suelto = rendimientoDelDia({ especie: "camaleon", estado: sano });
    expect(copiando.monedas).toBeGreaterThan(suelto.monedas);
  });

  it("las legendarias rinden mas, pero el tope les manda igual", () => {
    const legendaria = rendimientoDelDia({ especie: "ballena", estado: sano });
    const comun = rendimientoDelDia({ especie: "abeja", estado: sano });
    expect(legendaria.monedas).toBeGreaterThan(comun.monedas);
    // Ni una legendaria de nivel alto pasa del techo: es lo que impide que un
    // hito del grupo rompa la economia para siempre.
    const desatada = rendimientoDelDia({
      especie: "ballena",
      estado: { hambre: 100, animo: 100, nivel: 20, xp: 0 },
    });
    expect(desatada.monedas).toBe(TOPE_DIARIO);
  });

  it("las especies de otros sistemas rinden lo normal, no cero", () => {
    // El cerdito sube la caja, el pulpo recorta esperas, el mapache roba
    // objetos. Su ventaja vive en otro sitio, pero comen y suben de nivel como
    // las demas: una especie que rindiera cero seria injugable hasta que se
    // cableara su sistema.
    for (const especie of ["cerdito", "pulpo", "mapache", "erizo"] as const) {
      const salida = rendimientoDelDia({ especie, estado: sano });
      expect(salida.monedas).toBeGreaterThan(0);
    }
  });

  it("ninguna especie del catalogo se pasa del tope", () => {
    for (const especie of ESPECIES_EN_ORDEN) {
      const salida = rendimientoDelDia({
        especie,
        estado: { hambre: 100, animo: 100, nivel: 20, xp: 0 },
        rasgos: ["gloton"],
        tirada: 0.999,
        contexto: {
          companeras: 100,
          esDeNoche: true,
          diasLimpios: 30,
          novatosQueSeQuedan: 50,
          clanActivo: true,
          diaDeLaRacha: 5,
          factorDelVecino: 3,
        },
      });
      expect(salida.monedas).toBeLessThanOrEqual(TOPE_DIARIO);
    }
  });
});
