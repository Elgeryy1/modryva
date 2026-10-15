import { describe, expect, it } from "vitest";
import {
  ESPECIES,
  ESPECIES_EN_ORDEN,
  esEspecieId,
  especiesDeFamilia,
  especiesPorRareza,
  saleDeHuevo,
} from "./especies.js";
import { esFamiliaId, FAMILIAS, FAMILIAS_EN_ORDEN } from "./familias.js";

describe("familias", () => {
  it("el orden nombra las seis, sin faltar ni repetir", () => {
    expect([...FAMILIAS_EN_ORDEN].sort()).toEqual(Object.keys(FAMILIAS).sort());
    expect(new Set(FAMILIAS_EN_ORDEN).size).toBe(FAMILIAS_EN_ORDEN.length);
  });

  it("cada familia se conoce a si misma por su clave", () => {
    for (const [clave, familia] of Object.entries(FAMILIAS)) {
      expect(familia.id).toBe(clave);
    }
  });

  it("reconoce los ids buenos y rechaza los que no lo son", () => {
    expect(esFamiliaId("bolsa")).toBe(true);
    expect(esFamiliaId("dinero")).toBe(false);
    // El registro es un objeto: sin `Object.hasOwn` esto seria `true` y
    // "toString" pasaria por familia.
    expect(esFamiliaId("toString")).toBe(false);
  });
});

describe("catalogo de especies", () => {
  it("el orden nombra todas, sin faltar ni repetir", () => {
    expect([...ESPECIES_EN_ORDEN].sort()).toEqual(Object.keys(ESPECIES).sort());
    expect(new Set(ESPECIES_EN_ORDEN).size).toBe(ESPECIES_EN_ORDEN.length);
  });

  it("cada especie se conoce a si misma por su clave", () => {
    for (const [clave, especie] of Object.entries(ESPECIES)) {
      expect(especie.id).toBe(clave);
    }
  });

  it("toda especie pertenece a una familia que existe", () => {
    for (const especie of Object.values(ESPECIES)) {
      expect(FAMILIAS[especie.familia]).toBeDefined();
    }
  });

  it("toda familia tiene al menos una comun: nadie se queda sin puerta", () => {
    // El huevo basico solo saca comunes. Una familia sin comun seria una
    // familia a la que no se puede entrar por la via barata.
    const conComun = new Set(
      especiesPorRareza("comun").map((especie) => especie.familia),
    );
    expect([...conComun].sort()).toEqual([...FAMILIAS_EN_ORDEN].sort());
  });

  it("cada familia tiene cuatro o cinco especies", () => {
    // Ni una familia enorme ni una de una sola: el huevo de familia se compra
    // eligiendo direccion, y con una sola especie dentro dejaria de haber
    // sorpresa.
    for (const familia of FAMILIAS_EN_ORDEN) {
      const suyas = especiesDeFamilia(familia).filter((e) =>
        saleDeHuevo(e.rareza),
      );
      expect(suyas.length).toBeGreaterThanOrEqual(4);
      expect(suyas.length).toBeLessThanOrEqual(5);
    }
  });

  it("hay veinticinco de huevo y cinco legendarias", () => {
    const deHuevo = Object.values(ESPECIES).filter((e) =>
      saleDeHuevo(e.rareza),
    );
    const legendarias = Object.values(ESPECIES).filter(
      (e) => e.rareza === "legendaria",
    );
    const staff = Object.values(ESPECIES).filter((e) => e.rareza === "staff");
    expect(deHuevo).toHaveLength(25);
    expect(legendarias).toHaveLength(5);
    expect(staff.length).toBeGreaterThan(0);
  });

  it("ningun huevo puede sacar una legendaria", () => {
    // Las legendarias se consiguen por hito, nunca abriendo huevos. Hoy no hay
    // ninguna declarada; el test existe para el dia que las haya, porque
    // entonces esta consulta seguira sin poder devolverlas.
    for (const rareza of ["comun", "pocoComun", "raro"] as const) {
      for (const especie of especiesPorRareza(rareza)) {
        expect(especie.rareza).not.toBe("legendaria");
      }
    }
  });

  it("agrupa por familia respetando el orden del catalogo", () => {
    const deBolsa = especiesDeFamilia("bolsa");
    expect(deBolsa.map((especie) => especie.id)).toEqual([
      "abeja",
      "ardilla",
      "hormiga",
      "cerdito",
      "ballena",
      "caballo",
    ]);
    for (const especie of especiesDeFamilia("sombra")) {
      expect(especie.familia).toBe("sombra");
    }
  });

  it("reconoce los ids buenos y rechaza los que no lo son", () => {
    expect(esEspecieId("abeja")).toBe(true);
    expect(esEspecieId("dragon")).toBe(true);
    expect(esEspecieId("unicornio")).toBe(false);
    expect(esEspecieId("constructor")).toBe(false);
  });

  it("nadie tiene el texto vacio: todo esto se lee en pantalla", () => {
    for (const especie of Object.values(ESPECIES)) {
      expect(especie.nombre.length).toBeGreaterThan(0);
      expect(especie.glifo.length).toBeGreaterThan(0);
      expect(especie.descripcion.length).toBeGreaterThan(0);
    }
  });

  it("la rana rinde de media menos que la abeja", () => {
    // Es la razon de existir de la abeja. Si la esperanza de la rana igualara a
    // la renta fija, elegir la abeja seria elegir peor siempre.
    const abeja = ESPECIES.abeja.efecto;
    const rana = ESPECIES.rana.efecto;
    if (abeja.clase !== "renta" || rana.clase !== "rentaAlAzar") {
      throw new Error("las dos especies han cambiado de clase de efecto");
    }
    const esperanzaDeLaRana = (rana.minimo + rana.maximo) / 2;
    expect(esperanzaDeLaRana).toBeLessThan(abeja.factor);
  });
});
