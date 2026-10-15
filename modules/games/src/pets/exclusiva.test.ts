import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { abrirHuevo } from "./eclosion.js";
import {
  ESPECIES,
  ESPECIES_EN_ORDEN,
  especiesPorRareza,
  RAREZAS_FUERA_DEL_HUEVO,
  type Rareza,
  saleDeHuevo,
} from "./especies.js";

/**
 * Noxel, la mascota exclusiva del propietario.
 *
 * Este fichero existe para una sola pregunta: **¿hay algun camino por el que
 * alguien pueda acabar teniendola?** Se prueba por agotamiento —las bolsas de
 * cada rareza, la eclosion con miles de tiradas, y la lista que decide todo—
 * en vez de comprobando una bandera, porque una bandera solo demuestra que la
 * bandera esta puesta.
 */

const RAIZ = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

/** Los nombres de los trozos de un PNG, en orden. */
const trozos = (bytes: Buffer): string[] => {
  const nombres: string[] = [];
  let off = 8;
  while (off + 8 <= bytes.length) {
    const largo = bytes.readUInt32BE(off);
    const tipo = bytes.subarray(off + 4, off + 8).toString();
    nombres.push(tipo);
    if (tipo === "IEND") {
      break;
    }
    off += 12 + largo;
  }
  return nombres;
};

const TODAS_LAS_RAREZAS: readonly Rareza[] = [
  "comun",
  "pocoComun",
  "raro",
  "legendaria",
  "staff",
  "exclusiva",
];

describe("Noxel esta en el catalogo", () => {
  it("existe y se llama como toca", () => {
    const noxel = ESPECIES.noxel;
    expect(noxel).toBeDefined();
    expect(noxel.id).toBe("noxel");
    expect(noxel.nombre).toBe("Noxel");
    expect(noxel.rareza).toBe("exclusiva");
  });

  it("trae todos los campos que el modelo pide", () => {
    const noxel = ESPECIES.noxel;
    expect(noxel.glifo.length).toBeGreaterThan(0);
    expect(noxel.familia.length).toBeGreaterThan(0);
    expect(noxel.descripcion.length).toBeGreaterThan(0);
    expect(noxel.efecto.clase.length).toBeGreaterThan(0);
  });

  it("esta en el orden del catalogo, que es lo que recorren las pantallas", () => {
    // Declararla sin ponerla aqui la dejaria invisible en el corral y en la
    // Mini App: las dos iteran esta lista, no las claves del objeto.
    expect(ESPECIES_EN_ORDEN).toContain("noxel");
  });

  it("su id no choca con ninguno y el orden no repite", () => {
    expect(new Set(ESPECIES_EN_ORDEN).size).toBe(ESPECIES_EN_ORDEN.length);
    expect([...ESPECIES_EN_ORDEN].sort()).toEqual(Object.keys(ESPECIES).sort());
  });
});

describe("su sprite existe y es utilizable", () => {
  const RUTA = path.join(RAIZ, "apps/web/public/mascotas/noxel.png");

  it("el fichero esta donde la Mini App lo va a buscar", () => {
    // La ruta la compone `pets.service.ts` como `/mascotas/<id>.png`, asi que
    // el nombre del fichero ES el id. Un despiste aqui sale como imagen rota.
    expect(existsSync(RUTA)).toBe(true);
  });

  it("es un PNG de 256x256 con transparencia, como los demas", () => {
    const bytes = readFileSync(RUTA);
    expect(bytes.subarray(1, 4).toString()).toBe("PNG");
    // Ancho y alto viven en el IHDR, justo detras de la cabecera.
    expect(bytes.readUInt32BE(16)).toBe(256);
    expect(bytes.readUInt32BE(20)).toBe(256);
    // La transparencia se comprueba por lo que HACE, no por el formato: el
    // recortador escribe PNG con paleta (tipo 3) y la transparencia va en el
    // trozo tRNS, no en un canal alfa. Exigir RGBA aqui daria por rota una
    // imagen correcta — y es justo lo que hizo fallar la primera version.
    expect([3, 6]).toContain(bytes[25]);
    if (bytes[25] === 3) {
      expect(trozos(bytes)).toContain("tRNS");
    }
  });

  it("todas las especies del catalogo tienen su sprite", () => {
    // No solo Noxel: si esta comprobacion falla, alguien declaro una especie
    // sin dibujo y la Mini App la enseñaria rota.
    const sinSprite = ESPECIES_EN_ORDEN.filter(
      (id) =>
        !existsSync(path.join(RAIZ, `apps/web/public/mascotas/${id}.png`)),
    );
    expect(sinSprite).toEqual([]);
  });
});

describe("no se puede conseguir por ningun camino normal", () => {
  it("la rareza esta declarada fuera del huevo", () => {
    expect(RAREZAS_FUERA_DEL_HUEVO).toContain("exclusiva");
    expect(saleDeHuevo("exclusiva")).toBe(false);
  });

  it("no aparece en la bolsa de NINGUNA rareza", () => {
    // Es la guarda de verdad: la eclosion elige de estas bolsas, asi que si no
    // esta en ninguna no hay parametro que manipular para sacarla.
    for (const rareza of TODAS_LAS_RAREZAS) {
      const ids = especiesPorRareza(rareza).map((especie) => especie.id);
      expect(ids).not.toContain("noxel");
    }
  });

  it("no sale de mil huevos basicos ni de mil de familia", () => {
    // Por agotamiento y no por confianza: la eclosion mira rarezas, y una
    // tirada extrema podria pedir una rareza que no existe y caer donde no
    // toca. Mil de cada cubre de sobra las colas.
    for (let i = 0; i < 1000; i += 1) {
      const basico = abrirHuevo({
        tipo: "basico",
        serverSeed: `semilla-${i}`,
        clientSeed: "cliente",
        nonce: i,
      });
      expect(basico?.especie).not.toBe("noxel");
    }
    for (let i = 0; i < 1000; i += 1) {
      const familia = abrirHuevo({
        tipo: "familia",
        familia: "sombra",
        serverSeed: `semilla-fam-${i}`,
        clientSeed: "cliente",
        nonce: i,
      });
      expect(familia?.especie).not.toBe("noxel");
    }
  });

  it("tampoco sale pidiendo su propia familia", () => {
    // El huevo de familia deja elegir; Sombra es la suya, asi que es el camino
    // mas cercano que existe a "pedirla". Sigue sin poder salir.
    const deSombra = especiesPorRareza("comun")
      .concat(especiesPorRareza("pocoComun"), especiesPorRareza("raro"))
      .filter((especie) => especie.familia === "sombra")
      .map((especie) => especie.id);
    expect(deSombra).not.toContain("noxel");
  });

  it("no esta en la tienda", async () => {
    // La tienda vende huevos y juguetes, nunca especies. Se comprueba igual
    // porque "no esta hoy" y "no puede estar" se parecen demasiado.
    const { SHOP_CATALOG } = await import("../shop.js");
    const ids = SHOP_CATALOG.map((item) => item.id as string);
    expect(ids).not.toContain("noxel");
  });
});

describe("la rareza exclusiva no se confunde con la de staff", () => {
  it("Noxel es la unica exclusiva", () => {
    expect(especiesPorRareza("exclusiva")).toEqual([]);
    const exclusivas = ESPECIES_EN_ORDEN.filter(
      (id) => ESPECIES[id].rareza === "exclusiva",
    );
    expect(exclusivas).toEqual(["noxel"]);
  });

  it("las de staff siguen siendo suyas y no la incluyen", () => {
    // Si compartieran rareza, "las mascotas del equipo" pasaria a incluir una
    // que no lo es, y el corral las marcaria igual.
    const deStaff = ESPECIES_EN_ORDEN.filter(
      (id) => ESPECIES[id].rareza === "staff",
    );
    expect(deStaff).not.toContain("noxel");
    expect(deStaff.length).toBeGreaterThan(0);
  });
});
