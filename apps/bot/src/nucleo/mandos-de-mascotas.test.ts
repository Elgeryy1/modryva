import type { PetState } from "@superbot/data";
import { AJUSTES_POR_DEFECTO } from "@superbot/module-games";
import { describe, expect, it } from "vitest";

import {
  atenderMandoDeMascotas,
  type DependenciasDeMandos,
} from "./mandos-de-mascotas.js";

const AHORA = new Date("2026-09-02T12:00:00Z");
const HORA = 3_600_000;
// Un id inventado. Los de Telegram son datos personales y la regla del repo
// dice que no entran en git.
const OBJETIVO = 12_345n;

const fila = (parcial: Partial<PetState> = {}): PetState =>
  ({
    id: "p1",
    tenantId: "t1",
    chatId: "c1",
    userTelegramId: OBJETIVO,
    especie: "caballo",
    rasgos: [],
    nombre: null,
    hambre: 80,
    animo: 70,
    nivel: 4,
    xp: 0,
    vistaEn: AHORA,
    racionesHoy: 0,
    racionesDia: null,
    xpDia: null,
    hambreMax: 0,
    hambreMaxDia: null,
    animoDia: null,
    juguetesHoy: 0,
    juguetesDia: null,
    racha: 0,
    protegeA: null,
    robadoPendiente: 0,
    nonce: 0,
    huevosSinRara: 0,
    regalada: false,
    nacidaEn: AHORA,
    enfermaDesde: null,
    enfermaMotivo: null,
    curaCoste: null,
    curaResto: null,
    curaVence: null,
    curaAvisos: 0,
    fallecidaEn: null,
    ...parcial,
  }) satisfies PetState;

/** Lo que se le ha pedido al mundo, para poder comprobarlo. */
interface Registro {
  enfermadas: {
    id: string;
    coste: number;
    resto: number;
    vence: Date;
    motivo: string;
  }[];
  sanadas: string[];
  revividas: string[];
  apuntes: { accion: string; resumen: string }[];
}

const deps = (
  opciones: {
    mascota?: PetState | null;
    saldo?: number;
    enfermaOk?: boolean;
    sanaOk?: boolean;
    reviveOk?: boolean;
  } = {},
): { dependencias: DependenciasDeMandos; registro: Registro } => {
  const registro: Registro = {
    enfermadas: [],
    sanadas: [],
    revividas: [],
    apuntes: [],
  };
  const dependencias: DependenciasDeMandos = {
    buscar: async () =>
      opciones.mascota === undefined ? fila() : opciones.mascota,
    enfermar: async (input) => {
      registro.enfermadas.push({
        id: input.id,
        coste: input.coste,
        resto: input.resto,
        vence: input.vence,
        motivo: input.motivo,
      });
      return opciones.enfermaOk ?? true;
    },
    sanar: async (id) => {
      registro.sanadas.push(id);
      return opciones.sanaOk ?? true;
    },
    revivir: async (id) => {
      registro.revividas.push(id);
      return opciones.reviveOk ?? true;
    },
    saldoDe: async () => opciones.saldo ?? 500_000_000,
    anotar: async (accion, resumen) => {
      registro.apuntes.push({ accion, resumen });
    },
    nombreDe: () => "Fulano",
    ajustes: AJUSTES_POR_DEFECTO,
    ahora: AHORA,
  };
  return { dependencias, registro };
};

const mandar = async (
  linea: string,
  opciones: Parameters<typeof deps>[0] & { esPropietario?: boolean } = {},
) => {
  const { dependencias, registro } = deps(opciones);
  const texto = await atenderMandoDeMascotas({
    partes: linea.split(" ").filter(Boolean),
    objetivo: OBJETIVO,
    esPropietario: opciones.esPropietario ?? true,
    dependencias,
  });
  return { texto: texto ?? "", registro };
};

describe("el permiso", () => {
  it("un admin de grupo no puede enfermar a nadie", async () => {
    // Un admin modera. Firmar una factura que vacia una cartera y puede acabar
    // en una mascota muerta no es moderar.
    const { texto, registro } = await mandar("enfermar colico", {
      esPropietario: false,
    });
    expect(texto).toContain("propietario");
    expect(registro.enfermadas).toEqual([]);
  });

  it("y tampoco se entera de si esa persona tiene bicho", async () => {
    // El permiso se comprueba ANTES de leer nada: si no puedes, la negativa no
    // puede filtrar informacion de otra persona.
    const { texto } = await mandar("sanar era broma", {
      esPropietario: false,
      mascota: null,
    });
    expect(texto).toContain("propietario");
    expect(texto).not.toContain("bicho");
  });
});

describe("enfermar", () => {
  it("la factura es todo lo que tiene menos el suelo, y se anota", async () => {
    const { texto, registro } = await mandar("enfermar 2500 72h colico");
    expect(registro.enfermadas).toHaveLength(1);
    const puesta = registro.enfermadas[0];
    expect(puesta?.coste).toBe(499_997_500);
    expect(puesta?.resto).toBe(2_500);
    expect(puesta?.vence.getTime()).toBe(AHORA.getTime() + 72 * HORA);
    // Sin el apunte no se puede contestar dentro de seis meses a por que se
    // murio ese bicho.
    expect(registro.apuntes).toHaveLength(1);
    expect(registro.apuntes[0]?.accion).toBe("pets.enfermada");
    expect(registro.apuntes[0]?.resumen).toContain("colico");
    // El nombre de quien le toca va en el mensaje: es la unica red que hay
    // contra haber respondido al mensaje equivocado.
    expect(texto).toContain("Fulano");
    expect(texto).toContain("499.997.500");
  });

  it("sin cifras usa las del grupo", async () => {
    const { registro } = await mandar("enfermar se lo ha buscado");
    expect(registro.enfermadas[0]?.resto).toBe(
      AJUSTES_POR_DEFECTO.restoTrasOperar,
    );
    expect(registro.enfermadas[0]?.vence.getTime()).toBe(
      AHORA.getTime() + AJUSTES_POR_DEFECTO.horasDePlazo * HORA,
    );
  });

  it("usa el nombre de la especie cuando no tiene mote", async () => {
    // La mayoria de las mascotas de produccion no tienen mote: un texto que
    // solo contara con el diria "su bicho" en el caso mas comun.
    const { texto } = await mandar("enfermar colico");
    expect(texto).toContain("Caballo");
  });

  it("no enferma a una dormida", async () => {
    const { texto, registro } = await mandar("enfermar colico", {
      mascota: fila({ hambre: 0 }),
    });
    expect(registro.enfermadas).toEqual([]);
    expect(texto).toContain("dormido");
  });

  it("no enferma a quien no tiene con que pagar", async () => {
    const { texto, registro } = await mandar("enfermar colico", {
      saldo: 2_500,
    });
    expect(registro.enfermadas).toEqual([]);
    expect(texto).toContain("no tiene");
  });

  it("no reenferma, ni siquiera si se manda dos veces", async () => {
    const { texto, registro } = await mandar("enfermar colico", {
      mascota: fila({ enfermaDesde: AHORA, curaCoste: 100 }),
    });
    expect(registro.enfermadas).toEqual([]);
    expect(texto).toContain("ya está enfermo");
  });

  it("si la base de datos dice que no, no se anota nada", async () => {
    // La carrera existe: dos mandos seguidos. Manda la base de datos, no lo
    // que creyera quien compuso el mensaje.
    const { texto, registro } = await mandar("enfermar colico", {
      enfermaOk: false,
    });
    expect(registro.apuntes).toEqual([]);
    expect(texto).toContain("ya está enfermo");
  });

  it("sin motivo no hace nada", async () => {
    const { registro } = await mandar("enfermar");
    expect(registro.enfermadas).toEqual([]);
  });
});

describe("la marcha atras", () => {
  it("sanar cura gratis y deja constancia", async () => {
    const { texto, registro } = await mandar("sanar era broma");
    expect(registro.sanadas).toEqual(["p1"]);
    expect(registro.apuntes[0]?.accion).toBe("pets.sanada");
    expect(texto).toContain("curado");
  });

  it("revivir la devuelve a la vida", async () => {
    const { texto, registro } = await mandar("revivir me he pasado");
    expect(registro.revividas).toEqual(["p1"]);
    expect(registro.apuntes[0]?.accion).toBe("pets.revivida");
    expect(texto).toContain("ha vuelto");
  });

  it("sanar a una sana lo dice y no anota", async () => {
    const { texto, registro } = await mandar("sanar era broma", {
      sanaOk: false,
    });
    expect(registro.apuntes).toEqual([]);
    expect(texto).toContain("no está enfermo");
  });
});

describe("lo que aun no esta", () => {
  it("los cinco subcomandos viejos lo dicen en vez de fingir", async () => {
    for (const linea of [
      "huevo",
      "dar cisne compensacion",
      "set hambre 50 porque si",
      "quitar se acabo",
      "ver",
    ]) {
      const { texto, registro } = await mandar(linea);
      expect(texto).toContain("cableado");
      expect(registro.apuntes).toEqual([]);
    }
  });
});

describe("sin objetivo", () => {
  it("hay que responder a alguien", async () => {
    const { dependencias } = deps();
    const texto = await atenderMandoDeMascotas({
      partes: ["enfermar", "colico"],
      objetivo: undefined,
      esPropietario: true,
      dependencias,
    });
    expect(texto).toContain("Responde al mensaje");
  });
});
