import { describe, expect, it } from "vitest";

import { commit, verifyCommit } from "../fairness.js";
import {
  abrirHuevo,
  HUEVOS_SIN_RARA_PARA_GARANTIA,
  siguienteRachaSinRara,
  TABLA_DE_FAMILIA,
} from "./eclosion.js";
import {
  ESPECIES,
  especiesPorRareza,
  RAREZAS_FUERA_DEL_HUEVO,
  saleDeHuevo,
} from "./especies.js";
import { FAMILIAS_EN_ORDEN } from "./familias.js";
import { sonCompatibles } from "./rasgos.js";

const SEMILLA = "a".repeat(64);
const CLIENTE = "district-x";

describe("la tabla del huevo de familia", () => {
  it("suma uno: nadie se queda sin resultado", () => {
    const total = TABLA_DE_FAMILIA.reduce((suma, [, peso]) => suma + peso, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe("abrir un huevo", () => {
  it("la misma semilla da siempre el mismo bicho", () => {
    // Es LA propiedad del commit-reveal: sin ella, "recomputalo tu mismo" no
    // significa nada.
    const uno = abrirHuevo({
      tipo: "basico",
      serverSeed: SEMILLA,
      clientSeed: CLIENTE,
      nonce: 7,
    });
    const otro = abrirHuevo({
      tipo: "basico",
      serverSeed: SEMILLA,
      clientSeed: CLIENTE,
      nonce: 7,
    });
    expect(uno).toEqual(otro);
  });

  it("el hash que se enseño al comprar verifica la semilla revelada", () => {
    expect(verifyCommit(SEMILLA, commit(SEMILLA))).toBe(true);
    expect(verifyCommit("b".repeat(64), commit(SEMILLA))).toBe(false);
  });

  it("nonces distintos dan resultados distintos", () => {
    const resultados = new Set(
      Array.from({ length: 20 }, (_, nonce) =>
        JSON.stringify(
          abrirHuevo({
            tipo: "basico",
            serverSeed: SEMILLA,
            clientSeed: CLIENTE,
            nonce,
          }),
        ),
      ),
    );
    expect(resultados.size).toBeGreaterThan(1);
  });

  it("el huevo basico solo saca comunes", () => {
    for (let nonce = 0; nonce < 60; nonce += 1) {
      const salida = abrirHuevo({
        tipo: "basico",
        serverSeed: SEMILLA,
        clientSeed: CLIENTE,
        nonce,
      });
      if (!salida) {
        throw new Error("el huevo basico nunca deberia salir vacio");
      }
      expect(ESPECIES[salida.especie].rareza).toBe("comun");
    }
  });

  it("el huevo basico puede sacar de cualquier familia", () => {
    const familias = new Set(
      Array.from({ length: 80 }, (_, nonce) => {
        const salida = abrirHuevo({
          tipo: "basico",
          serverSeed: SEMILLA,
          clientSeed: CLIENTE,
          nonce,
        });
        return salida ? ESPECIES[salida.especie].familia : "";
      }),
    );
    expect(familias.size).toBeGreaterThan(1);
  });

  it("el huevo de familia respeta la familia que se pago", () => {
    // Es lo que se compra: eliges la direccion, el azar elige el detalle. Si
    // esto falla, el jugador ha pagado el doble por nada.
    for (let nonce = 0; nonce < 40; nonce += 1) {
      const salida = abrirHuevo({
        tipo: "familia",
        familia: "sombra",
        serverSeed: SEMILLA,
        clientSeed: CLIENTE,
        nonce,
      });
      if (!salida) {
        throw new Error("la familia sombra tiene especies declaradas");
      }
      expect(ESPECIES[salida.especie].familia).toBe("sombra");
    }
  });

  it("un huevo de familia sin familia no sale", () => {
    expect(
      abrirHuevo({
        tipo: "familia",
        serverSeed: SEMILLA,
        clientSeed: CLIENTE,
        nonce: 1,
      }),
    ).toBeNull();
  });

  it("la garantia entrega una rara de verdad", () => {
    // Con el catalogo completo, cada familia tiene su rara y la mala racha se
    // paga con lo prometido. Cuando solo habia comunes declaradas, esto caia a
    // comun y `porGarantia` salia false a proposito, para no anunciar un premio
    // que no habia llegado.
    const salida = abrirHuevo({
      tipo: "familia",
      familia: "bolsa",
      serverSeed: SEMILLA,
      clientSeed: CLIENTE,
      nonce: 3,
      huevosSinRara: HUEVOS_SIN_RARA_PARA_GARANTIA,
    });
    if (!salida) {
      throw new Error("la familia bolsa tiene rara declarada");
    }
    expect(ESPECIES[salida.especie].rareza).toBe("raro");
    expect(salida.porGarantia).toBe(true);
  });

  it("siempre da uno o dos rasgos, y compatibles entre si", () => {
    for (let nonce = 0; nonce < 60; nonce += 1) {
      const salida = abrirHuevo({
        tipo: "basico",
        serverSeed: SEMILLA,
        clientSeed: CLIENTE,
        nonce,
      });
      if (!salida) {
        throw new Error("el huevo basico nunca deberia salir vacio");
      }
      expect(salida.rasgos.length).toBeGreaterThanOrEqual(1);
      expect(salida.rasgos.length).toBeLessThanOrEqual(2);
      const [uno, otro] = salida.rasgos;
      if (uno && otro) {
        expect(sonCompatibles(uno, otro)).toBe(true);
      }
    }
  });

  it("dos bichos de la misma especie no salen con los mismos rasgos siempre", () => {
    // Es la razon de ser de los rasgos: con un catalogo grande van a salir
    // segundas abejas, y una segunda abeja identica seria un huevo vacio.
    const porEspecie = new Map<string, Set<string>>();
    for (let nonce = 0; nonce < 120; nonce += 1) {
      const salida = abrirHuevo({
        tipo: "basico",
        serverSeed: SEMILLA,
        clientSeed: CLIENTE,
        nonce,
      });
      if (!salida) {
        continue;
      }
      const vistos = porEspecie.get(salida.especie) ?? new Set<string>();
      vistos.add([...salida.rasgos].sort().join("+"));
      porEspecie.set(salida.especie, vistos);
    }
    const conVariedad = [...porEspecie.values()].filter(
      (rasgos) => rasgos.size > 1,
    );
    expect(conVariedad.length).toBeGreaterThan(0);
  });
});

describe("la racha sin rara", () => {
  it("sube con cada huevo de familia que no da rara", () => {
    expect(siguienteRachaSinRara(2, "familia", false)).toBe(3);
  });

  it("se pone a cero cuando sale la rara", () => {
    expect(siguienteRachaSinRara(4, "familia", true)).toBe(0);
  });

  it("los huevos basicos no cuentan: no prometen raras", () => {
    expect(siguienteRachaSinRara(3, "basico", false)).toBe(3);
  });

  it("un contador corrupto no se propaga en negativo", () => {
    expect(siguienteRachaSinRara(-9, "familia", false)).toBe(1);
  });
});

describe("lo que no sale de un huevo, no sale nunca", () => {
  it("ni una legendaria ni una de staff sale de un huevo basico", () => {
    for (let nonce = 0; nonce < 200; nonce += 1) {
      const salida = abrirHuevo({
        tipo: "basico",
        serverSeed: SEMILLA,
        clientSeed: CLIENTE,
        nonce,
      });
      if (!salida) {
        continue;
      }
      expect(saleDeHuevo(ESPECIES[salida.especie].rareza)).toBe(true);
    }
  });

  it("tampoco de uno de familia, ni con la garantia activada", () => {
    // La garantia sube la rareza pedida. Si el filtro no fuera hermetico, seria
    // justo el camino por el que se colaria una de staff a alguien que no es
    // del staff.
    for (const familia of FAMILIAS_EN_ORDEN) {
      for (let nonce = 0; nonce < 30; nonce += 1) {
        const salida = abrirHuevo({
          tipo: "familia",
          familia,
          serverSeed: SEMILLA,
          clientSeed: CLIENTE,
          nonce,
          huevosSinRara: HUEVOS_SIN_RARA_PARA_GARANTIA,
        });
        if (!salida) {
          continue;
        }
        expect(saleDeHuevo(ESPECIES[salida.especie].rareza)).toBe(true);
      }
    }
  });

  it("pedir esas rarezas por su nombre devuelve la lista vacia", () => {
    // La puerta se cierra en `especiesPorRareza`, que es por donde entra la
    // eclosion. Pedirla a proposito tampoco vale.
    for (const rareza of RAREZAS_FUERA_DEL_HUEVO) {
      expect(especiesPorRareza(rareza)).toEqual([]);
    }
  });
});
