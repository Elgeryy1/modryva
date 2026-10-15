import type {
  AyudanteInvitacionRepository,
  EnlaceSincronizado,
  EntradaDeRanking,
} from "@superbot/data";
import { createLogger } from "@superbot/shared";
import { describe, expect, it } from "vitest";
import type {
  CatalogoDeManejadores,
  ContextoDeManejador,
} from "../despachador.js";
import { FakeUserbot } from "../fake-userbot.js";
import type { EnlaceInvitacionCrudo } from "../userbot-port.js";
import {
  calcularComision,
  type EntradaRankingConComision,
  manejadoresDeComunidad,
  type RepositoriosDeComunidad,
  type ResultadoLiquidarComision,
  type ResultadoSincronizarInvitaciones,
} from "./comunidad.js";

const logger = createLogger("comunidad-test", "silent");

/** `noUncheckedIndexedAccess` marca el acceso por clave como opcional; esto deja el resto del test sin ese ruido. */
const unManejador = (catalogo: CatalogoDeManejadores, tipo: string) => {
  const manejador = catalogo[tipo];
  if (!manejador) throw new Error(`falta el manejador de tipo "${tipo}"`);
  return manejador;
};

const crearContexto = (userbot: FakeUserbot): ContextoDeManejador => ({
  userbot,
  logger,
});

/**
 * En memoria, misma interfaz que la implementacion Prisma real, y con el
 * MISMO estado: `usosTotal` y `usosLiquidados` por enlace, en vez de un
 * ranking fijado a mano. Es lo que permite comprobar que liquidar dos veces
 * no paga dos veces -- con un ranking de mentira, ese fallo era invisible.
 */
class FakeInvitacionRepository implements AyudanteInvitacionRepository {
  sincronizados: {
    tenantId: string;
    chatId: string;
    enlaces: readonly EnlaceSincronizado[];
  }[] = [];
  enlaces: {
    creadorTelegramId: bigint;
    usosTotal: number;
    usosLiquidados: number;
  }[] = [];

  async sincronizar(input: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly enlaces: readonly EnlaceSincronizado[];
  }): Promise<void> {
    this.sincronizados.push({ ...input });
  }

  async rankingDeReclutadores(): Promise<readonly EntradaDeRanking[]> {
    const porCreador = new Map<string, EntradaDeRanking>();
    for (const enlace of this.enlaces) {
      const clave = enlace.creadorTelegramId.toString();
      const previo = porCreador.get(clave);
      porCreador.set(clave, {
        creadorTelegramId: enlace.creadorTelegramId,
        usosTotal: (previo?.usosTotal ?? 0) + enlace.usosTotal,
        usosPendientes:
          (previo?.usosPendientes ?? 0) +
          Math.max(0, enlace.usosTotal - enlace.usosLiquidados),
      });
    }
    return [...porCreador.values()].sort((a, b) => b.usosTotal - a.usosTotal);
  }

  async liquidarPendientes(input: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly creadorTelegramId: bigint;
  }): Promise<{ readonly usosLiquidadosAhora: number }> {
    let total = 0;
    for (const enlace of this.enlaces) {
      if (enlace.creadorTelegramId !== input.creadorTelegramId) continue;
      const pendientes = Math.max(0, enlace.usosTotal - enlace.usosLiquidados);
      if (pendientes === 0) continue;
      enlace.usosLiquidados = enlace.usosTotal;
      total += pendientes;
    }
    return { usosLiquidadosAhora: total };
  }
}

describe("comunidad.sincronizar_invitaciones", () => {
  it("lista enlaces del userbot, los sincroniza en el repositorio y devuelve el total", async () => {
    const invitaciones = new FakeInvitacionRepository();
    const repos: RepositoriosDeComunidad = { invitaciones };
    const manejadores = manejadoresDeComunidad(repos);

    const userbot = new FakeUserbot();
    const enlaces: EnlaceInvitacionCrudo[] = [
      { enlaceId: "e1", creadorTelegramId: 111n, usosTotal: 5 },
      { enlaceId: "e2", creadorTelegramId: 222n, usosTotal: 12 },
    ];
    userbot.enlaces.set("-1001", enlaces);

    const manejador = unManejador(
      manejadores,
      "comunidad.sincronizar_invitaciones",
    );
    const resultado = (await manejador(
      { tenantId: "t1", chatId: "-1001" },
      crearContexto(userbot),
    )) as ResultadoSincronizarInvitaciones;

    expect(resultado.total).toBe(2);
    expect(invitaciones.sincronizados).toHaveLength(1);
    expect(invitaciones.sincronizados[0]?.tenantId).toBe("t1");
    expect(invitaciones.sincronizados[0]?.chatId).toBe("-1001");
    expect(invitaciones.sincronizados[0]?.enlaces).toEqual([
      { enlaceId: "e1", creadorTelegramId: 111n, usosTotal: 5 },
      { enlaceId: "e2", creadorTelegramId: 222n, usosTotal: 12 },
    ]);
  });

  it("acepta chatId como texto numerico ademas de como number y devuelve total 0 sin enlaces", async () => {
    const invitaciones = new FakeInvitacionRepository();
    const manejadores = manejadoresDeComunidad({ invitaciones });
    const userbot = new FakeUserbot();
    userbot.enlaces.set("555", []);

    const manejador = unManejador(
      manejadores,
      "comunidad.sincronizar_invitaciones",
    );
    const resultado = (await manejador(
      { tenantId: "t1", chatId: 555 },
      crearContexto(userbot),
    )) as ResultadoSincronizarInvitaciones;

    expect(resultado.total).toBe(0);
    expect(invitaciones.sincronizados[0]?.chatId).toBe("555");
  });

  it("lanza si falta tenantId", async () => {
    const manejadores = manejadoresDeComunidad({
      invitaciones: new FakeInvitacionRepository(),
    });
    const manejador = unManejador(
      manejadores,
      "comunidad.sincronizar_invitaciones",
    );

    await expect(
      manejador({ chatId: "-1001" }, crearContexto(new FakeUserbot())),
    ).rejects.toThrow(/tenantId/);
  });

  it("lanza si chatId no es un entero valido", async () => {
    const manejadores = manejadoresDeComunidad({
      invitaciones: new FakeInvitacionRepository(),
    });
    const manejador = unManejador(
      manejadores,
      "comunidad.sincronizar_invitaciones",
    );

    await expect(
      manejador(
        { tenantId: "t1", chatId: "no-es-un-id" },
        crearContexto(new FakeUserbot()),
      ),
    ).rejects.toThrow(/chatId/);
  });
});

describe("calcularComision", () => {
  it("cero usos da comision cero, con cualquier tarifa", () => {
    expect(calcularComision(0, 10)).toBe(0);
    expect(calcularComision(0, 0)).toBe(0);
  });

  it("tarifa cero da comision cero, con cualquier numero de usos", () => {
    expect(calcularComision(50, 0)).toBe(0);
  });

  it("multiplica usos por tarifa en el caso normal", () => {
    expect(calcularComision(5, 10)).toBe(50);
  });

  it("redondea hacia abajo, sin fraccion de moneda", () => {
    expect(calcularComision(3, 1.5)).toBe(4);
  });

  it("nunca da una comision negativa", () => {
    expect(calcularComision(-5, 10)).toBe(0);
    expect(calcularComision(5, -10)).toBe(0);
  });
});

describe("comunidad.ranking_reclutadores", () => {
  it("envuelve el ranking del repositorio y añade la comision de cada fila", async () => {
    const invitaciones = new FakeInvitacionRepository();
    invitaciones.enlaces = [
      { creadorTelegramId: 111n, usosTotal: 12, usosLiquidados: 0 },
      { creadorTelegramId: 222n, usosTotal: 5, usosLiquidados: 0 },
    ];
    const manejadores = manejadoresDeComunidad({ invitaciones });

    const manejador = unManejador(
      manejadores,
      "comunidad.ranking_reclutadores",
    );
    const resultado = (await manejador(
      { tenantId: "t1", chatId: "-1001", tarifaPorUso: 10 },
      crearContexto(new FakeUserbot()),
    )) as readonly EntradaRankingConComision[];

    expect(resultado).toEqual([
      {
        creadorTelegramId: 111n,
        usosTotal: 12,
        usosPendientes: 12,
        comision: 120,
      },
      {
        creadorTelegramId: 222n,
        usosTotal: 5,
        usosPendientes: 5,
        comision: 50,
      },
    ]);
  });

  it("la comision del ranking sale de lo PENDIENTE, no del acumulado de por vida", async () => {
    const invitaciones = new FakeInvitacionRepository();
    // 40 usos de los cuales 38 ya se pagaron: quedan 2.
    invitaciones.enlaces = [
      { creadorTelegramId: 111n, usosTotal: 40, usosLiquidados: 38 },
    ];
    const manejadores = manejadoresDeComunidad({ invitaciones });

    const resultado = (await unManejador(
      manejadores,
      "comunidad.ranking_reclutadores",
    )(
      { tenantId: "t1", chatId: "-1001", tarifaPorUso: 10 },
      crearContexto(new FakeUserbot()),
    )) as readonly EntradaRankingConComision[];

    expect(resultado[0]?.usosTotal).toBe(40);
    expect(resultado[0]?.comision).toBe(20);
  });

  it("acepta tarifaPorUso como texto numerico y devuelve lista vacia sin reclutadores", async () => {
    const invitaciones = new FakeInvitacionRepository();
    const manejadores = manejadoresDeComunidad({ invitaciones });

    const manejador = unManejador(
      manejadores,
      "comunidad.ranking_reclutadores",
    );
    const resultado = (await manejador(
      { tenantId: "t1", chatId: "-1001", tarifaPorUso: "7.5" },
      crearContexto(new FakeUserbot()),
    )) as readonly EntradaRankingConComision[];

    expect(resultado).toEqual([]);
  });

  it("lanza si falta tarifaPorUso", async () => {
    const manejadores = manejadoresDeComunidad({
      invitaciones: new FakeInvitacionRepository(),
    });
    const manejador = unManejador(
      manejadores,
      "comunidad.ranking_reclutadores",
    );

    await expect(
      manejador(
        { tenantId: "t1", chatId: "-1001" },
        crearContexto(new FakeUserbot()),
      ),
    ).rejects.toThrow(/tarifaPorUso/);
  });
});

describe("comunidad.liquidar_comision", () => {
  it("paga lo pendiente la primera vez y CERO la segunda", async () => {
    const invitaciones = new FakeInvitacionRepository();
    invitaciones.enlaces = [
      { creadorTelegramId: 111n, usosTotal: 40, usosLiquidados: 0 },
    ];
    const manejadores = manejadoresDeComunidad({ invitaciones });
    const manejador = unManejador(manejadores, "comunidad.liquidar_comision");
    const payload = {
      tenantId: "t1",
      chatId: "-1001",
      creadorTelegramId: 111n.toString(),
      tarifaPorUso: 10,
    };

    const primera = (await manejador(
      payload,
      crearContexto(new FakeUserbot()),
    )) as ResultadoLiquidarComision;
    expect(primera).toEqual({ usosLiquidados: 40, comision: 400 });

    // La segunda pasada no puede volver a pagar la vida entera del enlace.
    // Este es el fallo concreto que tenia el ranking cuando calculaba la
    // comision sobre `usosTotal`.
    const segunda = (await manejador(
      payload,
      crearContexto(new FakeUserbot()),
    )) as ResultadoLiquidarComision;
    expect(segunda).toEqual({ usosLiquidados: 0, comision: 0 });
  });

  it("tras liquidar, el ranking sigue enseñando el total pero sin comision pendiente", async () => {
    const invitaciones = new FakeInvitacionRepository();
    invitaciones.enlaces = [
      { creadorTelegramId: 111n, usosTotal: 12, usosLiquidados: 0 },
    ];
    const manejadores = manejadoresDeComunidad({ invitaciones });

    await unManejador(manejadores, "comunidad.liquidar_comision")(
      {
        tenantId: "t1",
        chatId: "-1001",
        creadorTelegramId: "111",
        tarifaPorUso: 10,
      },
      crearContexto(new FakeUserbot()),
    );

    const ranking = (await unManejador(
      manejadores,
      "comunidad.ranking_reclutadores",
    )(
      { tenantId: "t1", chatId: "-1001", tarifaPorUso: 10 },
      crearContexto(new FakeUserbot()),
    )) as readonly EntradaRankingConComision[];

    expect(ranking[0]).toEqual({
      creadorTelegramId: 111n,
      usosTotal: 12,
      usosPendientes: 0,
      comision: 0,
    });
  });

  it("solo liquida al reclutador pedido", async () => {
    const invitaciones = new FakeInvitacionRepository();
    invitaciones.enlaces = [
      { creadorTelegramId: 111n, usosTotal: 10, usosLiquidados: 0 },
      { creadorTelegramId: 222n, usosTotal: 7, usosLiquidados: 0 },
    ];
    const manejadores = manejadoresDeComunidad({ invitaciones });

    await unManejador(manejadores, "comunidad.liquidar_comision")(
      {
        tenantId: "t1",
        chatId: "-1001",
        creadorTelegramId: "111",
        tarifaPorUso: 1,
      },
      crearContexto(new FakeUserbot()),
    );

    expect(invitaciones.enlaces).toEqual([
      { creadorTelegramId: 111n, usosTotal: 10, usosLiquidados: 10 },
      { creadorTelegramId: 222n, usosTotal: 7, usosLiquidados: 0 },
    ]);
  });
});
