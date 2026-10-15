import { describe, expect, it } from "vitest";
import type {
  ExplicacionesDeReglaPort,
  FuentesDeConfianzaPort,
  ReputacionDeFuente,
} from "../puertos.js";
import {
  explicacionesValidas,
  fuentesDeConfianzaValidas,
  registrarExplicacionDeRegla,
  registrarReputacionDeFuente,
} from "./ajustes-guardados.js";

/** Puerto de mentira con el mapa a la vista, para poder mirarlo despues. */
const puertoDeFuentes = (
  inicial: Record<string, ReputacionDeFuente> = {},
): FuentesDeConfianzaPort & {
  guardado: Record<string, ReputacionDeFuente>;
} => {
  const estado = { guardado: { ...inicial } };
  return {
    guardado: estado.guardado,
    leer: async () => estado.guardado,
    guardar: async (fuentes) => {
      for (const clave of Object.keys(estado.guardado)) {
        delete estado.guardado[clave];
      }
      Object.assign(estado.guardado, fuentes);
    },
  };
};

const puertoDeExplicaciones = (
  inicial: Record<string, string> = {},
): ExplicacionesDeReglaPort & { guardado: Record<string, string> } => {
  const estado = { guardado: { ...inicial } };
  return {
    guardado: estado.guardado,
    leer: async () => estado.guardado,
    guardar: async (explicaciones) => {
      for (const clave of Object.keys(estado.guardado)) {
        delete estado.guardado[clave];
      }
      Object.assign(estado.guardado, explicaciones);
    },
  };
};

describe("fuentesDeConfianzaValidas", () => {
  // El nucleo hacia `raw as Record<string, {trusted, score}>` tras comprobar
  // solo `typeof raw === "object"`. Un `as` no comprueba nada.
  it("acepta lo que tiene la forma correcta", () => {
    expect(
      fuentesDeConfianzaValidas({ blog: { trusted: true, score: 20 } }),
    ).toEqual({ blog: { trusted: true, score: 20 } });
  });

  it("descarta la entrada con la forma equivocada y conserva las buenas", () => {
    // Tirar el mapa entero por una entrada mala castigaria a las que si estan
    // bien; dejarla pasar la reescribe con la basura dentro.
    expect(
      fuentesDeConfianzaValidas({
        buena: { trusted: false, score: 3 },
        mala: "esto no es una reputacion",
        peor: { trusted: "si", score: "mucho" },
      }),
    ).toEqual({ buena: { trusted: false, score: 3 } });
  });

  it("un null no revienta", () => {
    // `typeof null === "object"`, que es justo lo que colaba antes.
    expect(fuentesDeConfianzaValidas(null)).toEqual({});
  });

  it("lo que no es objeto da un mapa vacio", () => {
    expect(fuentesDeConfianzaValidas("hola")).toEqual({});
    expect(fuentesDeConfianzaValidas(undefined)).toEqual({});
    expect(fuentesDeConfianzaValidas(42)).toEqual({});
  });
});

describe("explicacionesValidas", () => {
  it("se queda solo con las que son texto", () => {
    expect(
      explicacionesValidas({ regla: "porque si", otra: 42, mala: null }),
    ).toEqual({ regla: "porque si" });
  });

  it("un null da un mapa vacio", () => {
    expect(explicacionesValidas(null)).toEqual({});
  });
});

describe("registrarReputacionDeFuente", () => {
  it("pide el uso sin argumentos", async () => {
    expect(await registrarReputacionDeFuente([], undefined)).toContain(
      "Uso: /reputacion_contenido",
    );
  });

  it("guarda la fuente nueva SIN llevarse por delante las que habia", async () => {
    // Es el orden de efectos que justifica que esto salga del nucleo: leer,
    // mezclar y despues escribir. Escribiendo antes de leer, el mapa entero se
    // perderia con cada fuente nueva.
    const puerto = puertoDeFuentes({ vieja: { trusted: true, score: 30 } });

    await registrarReputacionDeFuente(["nueva", "25", "0"], puerto);

    expect(Object.keys(puerto.guardado).sort()).toEqual(["nueva", "vieja"]);
    expect(puerto.guardado.vieja).toEqual({ trusted: true, score: 30 });
  });

  it("una fuente con rechazos no es de fiar", async () => {
    const puerto = puertoDeFuentes();

    const salida = await registrarReputacionDeFuente(
      ["blog", "50", "1"],
      puerto,
    );

    expect(salida).toContain("no confiable");
    expect(puerto.guardado.blog?.trusted).toBe(false);
  });

  it("sin puerto calcula pero no guarda nada", async () => {
    expect(
      await registrarReputacionDeFuente(["blog", "50", "0"], undefined),
    ).toContain("confiable");
  });

  it("acepta cero aprobaciones y cero rechazos", async () => {
    expect(
      await registrarReputacionDeFuente(["blog", "0", "0"], undefined),
    ).not.toContain("Uso: ");
  });
});

describe("registrarExplicacionDeRegla", () => {
  it("pide el uso sin la barra", async () => {
    expect(
      await registrarExplicacionDeRegla(["solo el nombre"], undefined),
    ).toContain("Uso: /validar_explicacion");
  });

  it("una explicacion insuficiente NO se guarda", async () => {
    // Guardar una mala es peor que no guardar ninguna: la regla parece
    // explicada y nadie vuelve a mirarla.
    const puerto = puertoDeExplicaciones();

    const salida = await registrarExplicacionDeRegla(["regla|no"], puerto);

    expect(salida).toContain("⚠️");
    expect(puerto.guardado).toEqual({});
  });

  it("una buena se guarda junto a las que ya estaban", async () => {
    const puerto = puertoDeExplicaciones({
      vieja: "un motivo de los de antes",
    });

    await registrarExplicacionDeRegla(
      ["nueva|existe para que nadie pegue enlaces de spam en el grupo"],
      puerto,
    );

    expect(Object.keys(puerto.guardado).sort()).toEqual(["nueva", "vieja"]);
  });
});
