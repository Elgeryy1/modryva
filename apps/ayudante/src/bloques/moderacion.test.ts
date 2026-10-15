import type {
  AyudanteAdminLogRepository,
  EventoAdminLog,
  EventoAdminLogParaStaff,
} from "@superbot/data";
import { createLogger } from "@superbot/shared";
import { describe, expect, it } from "vitest";
import type {
  CatalogoDeManejadores,
  ContextoDeManejador,
} from "../despachador.js";
import { FakeUserbot } from "../fake-userbot.js";
import type { MensajeDeHistorial } from "../userbot-port.js";
import {
  distinguirBorradoPorAdmin,
  manejadoresDeModeracion,
  type RepositoriosDeModeracion,
  type ResultadoSincronizarAdminLog,
  vistaParaPropietario,
  vistaStaff,
} from "./moderacion.js";

const logger = createLogger("moderacion-test", "silent");

/** `noUncheckedIndexedAccess` marca el acceso por clave como opcional; esto deja el resto del test sin ese ruido. */
const unManejador = (catalogo: CatalogoDeManejadores, tipo: string) => {
  const manejador = catalogo[tipo];
  if (!manejador) throw new Error(`falta el manejador de tipo "${tipo}"`);
  return manejador;
};

/** En memoria, misma interfaz que la implementacion Prisma real. */
class FakeAdminLogRepository implements AyudanteAdminLogRepository {
  eventos: {
    tenantId: string;
    chatId: string;
    evento: EventoAdminLog;
  }[] = [];

  async ingerir(input: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly eventos: readonly EventoAdminLog[];
  }): Promise<{ readonly nuevos: number }> {
    let nuevos = 0;
    for (const evento of input.eventos) {
      const yaEstaba = this.eventos.some(
        (fila) =>
          fila.tenantId === input.tenantId &&
          fila.chatId === input.chatId &&
          fila.evento.telegramEventId === evento.telegramEventId,
      );
      if (yaEstaba) continue;
      this.eventos.push({
        tenantId: input.tenantId,
        chatId: input.chatId,
        evento,
      });
      nuevos += 1;
    }
    return { nuevos };
  }

  async listarParaStaff(): Promise<readonly EventoAdminLogParaStaff[]> {
    throw new Error("no usado en estos tests");
  }

  async listarCompleto(): Promise<readonly EventoAdminLog[]> {
    throw new Error("no usado en estos tests");
  }
}

const crearContexto = (userbot: FakeUserbot): ContextoDeManejador => ({
  userbot,
  logger,
});

const evento = (
  overrides: Partial<EventoAdminLog> & { readonly telegramEventId: string },
): EventoAdminLog => ({
  accion: "borrar_mensaje",
  actorTelegramId: 111n,
  objetivoTelegramId: null,
  detalle: null,
  ocurrioEn: new Date("2026-09-02T10:00:00.000Z"),
  ...overrides,
});

describe("moderacion.sincronizar_admin_log", () => {
  it("ingiere lo que devuelve el userbot y cuenta los nuevos", async () => {
    const adminLog = new FakeAdminLogRepository();
    const repos: RepositoriosDeModeracion = { adminLog };
    const manejadores = manejadoresDeModeracion(repos);

    const userbot = new FakeUserbot();
    userbot.eventosAdminLog.set("999", [
      {
        telegramEventId: "evt-1",
        accion: "borrar_mensaje",
        actorTelegramId: 111n,
        objetivoTelegramId: 222n,
        detalle: { motivo: "spam" },
        ocurrioEn: new Date("2026-09-02T10:00:00.000Z"),
      },
      {
        telegramEventId: "evt-2",
        accion: "cambiar_titulo",
        actorTelegramId: 333n,
        objetivoTelegramId: null,
        detalle: null,
        ocurrioEn: new Date("2026-09-02T11:00:00.000Z"),
      },
    ]);

    const manejador = unManejador(
      manejadores,
      "moderacion.sincronizar_admin_log",
    );
    const resultado = (await manejador(
      { tenantId: "tenant-1", chatId: 999, desde: "2026-09-01T00:00:00.000Z" },
      crearContexto(userbot),
    )) as ResultadoSincronizarAdminLog;

    expect(resultado.nuevos).toBe(2);
    expect(adminLog.eventos).toHaveLength(2);
    expect(adminLog.eventos[0]?.tenantId).toBe("tenant-1");
    expect(adminLog.eventos[0]?.chatId).toBe("999");
    expect(adminLog.eventos[0]?.evento.actorTelegramId).toBe(111n);
  });

  it("es idempotente: sincronizar el mismo tramo dos veces no duplica", async () => {
    const adminLog = new FakeAdminLogRepository();
    const manejadores = manejadoresDeModeracion({ adminLog });
    const userbot = new FakeUserbot();
    userbot.eventosAdminLog.set("999", [
      {
        telegramEventId: "evt-1",
        accion: "borrar_mensaje",
        actorTelegramId: 111n,
        objetivoTelegramId: null,
        detalle: null,
        ocurrioEn: new Date("2026-09-02T10:00:00.000Z"),
      },
    ]);

    const manejador = unManejador(
      manejadores,
      "moderacion.sincronizar_admin_log",
    );
    const payload = {
      tenantId: "tenant-1",
      chatId: 999,
      desde: "2026-09-01T00:00:00.000Z",
    };
    const primera = (await manejador(
      payload,
      crearContexto(userbot),
    )) as ResultadoSincronizarAdminLog;
    const segunda = (await manejador(
      payload,
      crearContexto(userbot),
    )) as ResultadoSincronizarAdminLog;

    expect(primera.nuevos).toBe(1);
    expect(segunda.nuevos).toBe(0);
    expect(adminLog.eventos).toHaveLength(1);
  });

  it("rechaza una fecha 'desde' que no es ISO valida", async () => {
    const manejadores = manejadoresDeModeracion({
      adminLog: new FakeAdminLogRepository(),
    });
    const manejador = unManejador(
      manejadores,
      "moderacion.sincronizar_admin_log",
    );

    await expect(
      manejador(
        { tenantId: "tenant-1", chatId: 999, desde: "no-es-una-fecha" },
        crearContexto(new FakeUserbot()),
      ),
    ).rejects.toThrow(/fecha ISO valida/);
  });
});

describe("vistaStaff", () => {
  it("agrupa por accion y cuenta, sin exponer nunca al actor", () => {
    const eventos: readonly EventoAdminLogParaStaff[] = [
      {
        accion: "borrar_mensaje",
        objetivoTelegramId: 1n,
        ocurrioEn: new Date("2026-09-02T10:00:00.000Z"),
      },
      {
        accion: "borrar_mensaje",
        objetivoTelegramId: 2n,
        ocurrioEn: new Date("2026-09-02T11:00:00.000Z"),
      },
      {
        accion: "expulsar",
        objetivoTelegramId: 3n,
        ocurrioEn: new Date("2026-09-02T09:00:00.000Z"),
      },
    ];

    const vista = vistaStaff(eventos);

    expect(vista.total).toBe(3);
    expect(vista.porAccion).toEqual([
      {
        accion: "borrar_mensaje",
        total: 2,
        ultimaVezEn: new Date("2026-09-02T11:00:00.000Z"),
      },
      {
        accion: "expulsar",
        total: 1,
        ultimaVezEn: new Date("2026-09-02T09:00:00.000Z"),
      },
    ]);

    // Ningun campo del resultado permite llegar al actor: el tipo de entrada ya no lo lleva.
    expect(JSON.stringify(vista)).not.toContain("actor");
  });

  it("da un resultado vacio sin eventos", () => {
    expect(vistaStaff([])).toEqual({ total: 0, porAccion: [] });
  });
});

describe("vistaParaPropietario", () => {
  it("conserva el actor y lo agrega por actividad, de mas a menos", () => {
    const eventos: readonly EventoAdminLog[] = [
      evento({ telegramEventId: "evt-1", actorTelegramId: 111n }),
      evento({ telegramEventId: "evt-2", actorTelegramId: 111n }),
      evento({ telegramEventId: "evt-3", actorTelegramId: 222n }),
    ];

    const vista = vistaParaPropietario(eventos);

    expect(vista.total).toBe(3);
    expect(vista.eventos).toBe(eventos);
    expect(vista.porActor).toEqual([
      { actorTelegramId: 111n, total: 2 },
      { actorTelegramId: 222n, total: 1 },
    ]);
  });
});

describe("distinguirBorradoPorAdmin", () => {
  const mensaje: MensajeDeHistorial = {
    messageId: 42,
    userTelegramId: 555n,
    texto: "hola",
    fecha: new Date("2026-09-02T10:00:00.000Z"),
    borradoPorAdmin: false,
  };

  it("da true cuando hay un borrado del admin log a menos de 2 minutos del mensaje", () => {
    const eventos: readonly EventoAdminLogParaStaff[] = [
      {
        accion: "borrar_mensaje",
        objetivoTelegramId: 555n,
        ocurrioEn: new Date("2026-09-02T10:01:30.000Z"),
      },
    ];

    expect(distinguirBorradoPorAdmin(mensaje, eventos)).toBe(true);
  });

  it("da false cuando el borrado esta fuera de la ventana de 2 minutos", () => {
    const eventos: readonly EventoAdminLogParaStaff[] = [
      {
        accion: "borrar_mensaje",
        objetivoTelegramId: 555n,
        ocurrioEn: new Date("2026-09-02T10:05:00.000Z"),
      },
    ];

    expect(distinguirBorradoPorAdmin(mensaje, eventos)).toBe(false);
  });

  it("da false cuando el evento cercano no es un borrado", () => {
    const eventos: readonly EventoAdminLogParaStaff[] = [
      {
        accion: "cambiar_titulo",
        objetivoTelegramId: null,
        ocurrioEn: new Date("2026-09-02T10:00:30.000Z"),
      },
    ];

    expect(distinguirBorradoPorAdmin(mensaje, eventos)).toBe(false);
  });

  it("da false sin eventos", () => {
    expect(distinguirBorradoPorAdmin(mensaje, [])).toBe(false);
  });
});

describe("moderacion.listar_reacciones y moderacion.listar_vistos", () => {
  it("listar_reacciones envuelve el resultado del userbot tal cual", async () => {
    const manejadores = manejadoresDeModeracion({
      adminLog: new FakeAdminLogRepository(),
    });
    const userbot = new FakeUserbot();
    userbot.reacciones.set("999:42", [{ userTelegramId: 1n, emoji: "👍" }]);

    const manejador = unManejador(manejadores, "moderacion.listar_reacciones");
    const resultado = await manejador(
      { chatId: 999, messageId: 42 },
      crearContexto(userbot),
    );

    expect(resultado).toEqual([{ userTelegramId: 1n, emoji: "👍" }]);
  });

  it("listar_vistos envuelve el resultado del userbot tal cual", async () => {
    const manejadores = manejadoresDeModeracion({
      adminLog: new FakeAdminLogRepository(),
    });
    const userbot = new FakeUserbot();
    userbot.vistos.set("999:42", [1n, 2n]);

    const manejador = unManejador(manejadores, "moderacion.listar_vistos");
    const resultado = await manejador(
      { chatId: 999, messageId: 42 },
      crearContexto(userbot),
    );

    expect(resultado).toEqual([1n, 2n]);
  });

  it("listar_vistos da un array vacio si no hay guion cargado", async () => {
    const manejadores = manejadoresDeModeracion({
      adminLog: new FakeAdminLogRepository(),
    });
    const manejador = unManejador(manejadores, "moderacion.listar_vistos");
    const resultado = await manejador(
      { chatId: 1, messageId: 2 },
      crearContexto(new FakeUserbot()),
    );

    expect(resultado).toEqual([]);
  });
});
