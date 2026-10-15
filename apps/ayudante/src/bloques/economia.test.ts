import type {
  AyudanteAvisoPrivadoRepository,
  EstadoAvisoPrivado,
  FilaAvisoPrivado,
} from "@superbot/data";
import { createLogger } from "@superbot/shared";
import { describe, expect, it } from "vitest";
import type {
  CatalogoDeManejadores,
  ContextoDeManejador,
} from "../despachador.js";
import { FakeUserbot } from "../fake-userbot.js";
import {
  componerTextoAvisoRobo,
  componerTextoRetoPrivado,
  componerTextoSemillaCasino,
  manejadoresDeEconomia,
  type RepositoriosDeEconomia,
  type ResultadoAvisarRobo,
  type ResultadoPublicarSemillaCasino,
  type ResultadoRetoPrivado,
} from "./economia.js";

const logger = createLogger("economia-test", "silent");

/** `noUncheckedIndexedAccess` marca el acceso por clave como opcional; esto deja el resto del test sin ese ruido. */
const unManejador = (catalogo: CatalogoDeManejadores, tipo: string) => {
  const manejador = catalogo[tipo];
  if (!manejador) throw new Error(`falta el manejador de tipo "${tipo}"`);
  return manejador;
};

/** En memoria, misma interfaz que la implementacion Prisma real. */
class FakeAvisoPrivadoRepository implements AyudanteAvisoPrivadoRepository {
  filas: FilaAvisoPrivado[] = [];
  private siguienteId = 1;

  async registrarPendiente(input: {
    readonly tenantId: string;
    readonly destinatarioTelegramId: bigint;
    readonly tipo: string;
    readonly detalle?: unknown;
  }): Promise<FilaAvisoPrivado> {
    const fila: FilaAvisoPrivado = {
      id: `aviso-${this.siguienteId++}`,
      tenantId: input.tenantId,
      destinatarioTelegramId: input.destinatarioTelegramId,
      tipo: input.tipo,
      estado: "pendiente",
      detalle: input.detalle ?? null,
      creadoEn: new Date(),
      enviadoEn: null,
    };
    this.filas.push(fila);
    return fila;
  }

  async marcarResultado(input: {
    readonly id: string;
    readonly estado: Exclude<EstadoAvisoPrivado, "pendiente">;
  }): Promise<void> {
    const fila = this.filas.find((f) => f.id === input.id);
    if (!fila) throw new Error(`no existe aviso con id ${input.id}`);
    (fila as { estado: EstadoAvisoPrivado }).estado = input.estado;
    (fila as { enviadoEn: Date | null }).enviadoEn = new Date();
  }

  /**
   * Fiel a la implementacion Prisma: se deriva de `filas` y cuenta `enviado`
   * y `pendiente`. Un fake que devolviera siempre `false` volveria a dejar
   * pasar el fallo de los avisos repetidos en cada barrido.
   */
  async yaSeAviso(input: {
    readonly tenantId: string;
    readonly destinatarioTelegramId: bigint;
    readonly tipo: string;
    readonly desde: Date;
  }): Promise<boolean> {
    return this.filas.some(
      (fila) =>
        fila.tenantId === input.tenantId &&
        fila.destinatarioTelegramId === input.destinatarioTelegramId &&
        fila.tipo === input.tipo &&
        (fila.estado === "enviado" || fila.estado === "pendiente") &&
        fila.creadoEn >= input.desde,
    );
  }
}

const crearContexto = (userbot: FakeUserbot): ContextoDeManejador => ({
  userbot,
  logger,
});

describe("textos -- puros", () => {
  it("componerTextoSemillaCasino incluye el hash y la hora en claro", () => {
    const texto = componerTextoSemillaCasino({
      serverSeedHash: "abc123",
      hora: "2026-09-02T02:00:00.000Z",
    });

    expect(texto).toContain("abc123");
    expect(texto).toContain("2026-09-02T02:00:00.000Z");
  });

  it("componerTextoAvisoRobo incluye la cantidad y quien robo", () => {
    const texto = componerTextoAvisoRobo({
      ladronTelegramId: 111n,
      cantidad: 250,
    });

    expect(texto).toContain("250");
    expect(texto).toContain("111");
  });

  it("componerTextoRetoPrivado incluye el juego y quien reta", () => {
    const texto = componerTextoRetoPrivado({
      retadorTelegramId: 222n,
      juego: "duelo de dados",
    });

    expect(texto).toContain("duelo de dados");
    expect(texto).toContain("222");
  });
});

describe("economia.publicar_semilla_casino", () => {
  it("publica en el canal, no manda un privado", async () => {
    const repos: RepositoriosDeEconomia = {
      avisos: new FakeAvisoPrivadoRepository(),
    };
    const manejadores = manejadoresDeEconomia(repos);
    const manejador = unManejador(
      manejadores,
      "economia.publicar_semilla_casino",
    );
    const userbot = new FakeUserbot();

    const resultado = (await manejador(
      {
        canalId: 999,
        serverSeedHash: "hash-de-la-semilla",
        hora: "2026-09-02T02:00:00.000Z",
      },
      crearContexto(userbot),
    )) as ResultadoPublicarSemillaCasino;

    // Un canal no es un destinatario: pasarlo por `enviarPrivado` fallaria al
    // resolver la entidad, o acertaria con el usuario cuyo id coincide.
    expect(userbot.enviados).toHaveLength(0);
    expect(userbot.publicados).toHaveLength(1);
    expect(userbot.publicados[0]?.canalId).toBe(999n);
    expect(userbot.publicados[0]?.texto).toContain("hash-de-la-semilla");
    expect(resultado.texto).toContain("hash-de-la-semilla");
    expect(resultado.ok).toBe(true);
  });

  it("lanza si la publicacion no sale, para que se reintente", async () => {
    const manejadores = manejadoresDeEconomia({
      avisos: new FakeAvisoPrivadoRepository(),
    });
    const userbot = new FakeUserbot();
    userbot.publicarEnCanalOk = false;

    // Una semilla que no llego a publicarse no puede darse por hecha: su
    // razon de ser es que cualquiera pueda comprobar el sorteo.
    await expect(
      unManejador(manejadores, "economia.publicar_semilla_casino")(
        { canalId: 999, serverSeedHash: "x", hora: "2026-09-02T02:00:00.000Z" },
        crearContexto(userbot),
      ),
    ).rejects.toThrow(/no se pudo publicar/);
  });

  it("no toca el repositorio de avisos privados -- es una publicacion, no un aviso a una persona", async () => {
    const avisos = new FakeAvisoPrivadoRepository();
    const manejadores = manejadoresDeEconomia({ avisos });
    const manejador = unManejador(
      manejadores,
      "economia.publicar_semilla_casino",
    );

    await manejador(
      { canalId: 999, serverSeedHash: "x", hora: "2026-09-02T02:00:00.000Z" },
      crearContexto(new FakeUserbot()),
    );

    expect(avisos.filas).toHaveLength(0);
  });

  it("lanza si serverSeedHash falta", async () => {
    const manejadores = manejadoresDeEconomia({
      avisos: new FakeAvisoPrivadoRepository(),
    });
    const manejador = unManejador(
      manejadores,
      "economia.publicar_semilla_casino",
    );

    await expect(
      manejador(
        { canalId: 999, hora: "2026-09-02T02:00:00.000Z" },
        crearContexto(new FakeUserbot()),
      ),
    ).rejects.toThrow(/serverSeedHash/);
  });

  it("lanza si hora no es una fecha valida", async () => {
    const manejadores = manejadoresDeEconomia({
      avisos: new FakeAvisoPrivadoRepository(),
    });
    const manejador = unManejador(
      manejadores,
      "economia.publicar_semilla_casino",
    );

    await expect(
      manejador(
        { canalId: 999, serverSeedHash: "x", hora: "no-es-una-fecha" },
        crearContexto(new FakeUserbot()),
      ),
    ).rejects.toThrow(/hora/);
  });
});

describe("economia.avisar_robo", () => {
  it("registra el aviso pendiente, lo envia y marca el resultado", async () => {
    const avisos = new FakeAvisoPrivadoRepository();
    const manejadores = manejadoresDeEconomia({ avisos });
    const manejador = unManejador(manejadores, "economia.avisar_robo");
    const userbot = new FakeUserbot();

    const resultado = (await manejador(
      {
        tenantId: "t1",
        victimaTelegramId: 555,
        ladronTelegramId: 111,
        cantidad: 250,
      },
      crearContexto(userbot),
    )) as ResultadoAvisarRobo;

    expect(resultado.resultado).toEqual({
      yaAvisado: false,
      envio: { estado: "enviado" },
    });
    expect(userbot.enviados).toHaveLength(1);
    expect(userbot.enviados[0]?.userTelegramId).toBe(555n);
    expect(userbot.enviados[0]?.texto).toContain("250");

    expect(avisos.filas).toHaveLength(1);
    expect(avisos.filas[0]).toMatchObject({
      tenantId: "t1",
      destinatarioTelegramId: 555n,
      tipo: "economia.aviso_robo",
      estado: "enviado",
    });
  });

  it("sigue avisando y registrando el estado aunque el destinatario tenga el bot bloqueado", async () => {
    const avisos = new FakeAvisoPrivadoRepository();
    const manejadores = manejadoresDeEconomia({ avisos });
    const manejador = unManejador(manejadores, "economia.avisar_robo");
    const userbot = new FakeUserbot();
    userbot.resultadoEnvioPrivado = { estado: "bloqueado" };

    const resultado = (await manejador(
      {
        tenantId: "t1",
        victimaTelegramId: 555,
        ladronTelegramId: 111,
        cantidad: 250,
      },
      crearContexto(userbot),
    )) as ResultadoAvisarRobo;

    expect(resultado.resultado).toEqual({
      yaAvisado: false,
      envio: { estado: "bloqueado" },
    });
    expect(avisos.filas[0]?.estado).toBe("bloqueado");
  });

  it("acepta ids y cantidad como texto numerico ademas de como number", async () => {
    const avisos = new FakeAvisoPrivadoRepository();
    const manejadores = manejadoresDeEconomia({ avisos });
    const manejador = unManejador(manejadores, "economia.avisar_robo");

    const resultado = (await manejador(
      {
        tenantId: "t1",
        victimaTelegramId: "555",
        ladronTelegramId: "111",
        cantidad: "250",
      },
      crearContexto(new FakeUserbot()),
    )) as ResultadoAvisarRobo;

    expect(resultado.resultado).toEqual({
      yaAvisado: false,
      envio: { estado: "enviado" },
    });
  });

  it("lanza si falta tenantId", async () => {
    const manejadores = manejadoresDeEconomia({
      avisos: new FakeAvisoPrivadoRepository(),
    });
    const manejador = unManejador(manejadores, "economia.avisar_robo");

    await expect(
      manejador(
        { victimaTelegramId: 555, ladronTelegramId: 111, cantidad: 250 },
        crearContexto(new FakeUserbot()),
      ),
    ).rejects.toThrow(/tenantId/);
  });

  it("lanza si cantidad no es un numero valido", async () => {
    const manejadores = manejadoresDeEconomia({
      avisos: new FakeAvisoPrivadoRepository(),
    });
    const manejador = unManejador(manejadores, "economia.avisar_robo");

    await expect(
      manejador(
        {
          tenantId: "t1",
          victimaTelegramId: 555,
          ladronTelegramId: 111,
          cantidad: "no-es-un-numero",
        },
        crearContexto(new FakeUserbot()),
      ),
    ).rejects.toThrow(/cantidad/);
  });
});

describe("economia.reto_privado", () => {
  it("invita al retado por privado y deja registro del aviso", async () => {
    const avisos = new FakeAvisoPrivadoRepository();
    const manejadores = manejadoresDeEconomia({ avisos });
    const manejador = unManejador(manejadores, "economia.reto_privado");
    const userbot = new FakeUserbot();

    const resultado = (await manejador(
      {
        tenantId: "t1",
        retadorTelegramId: 222,
        retadoTelegramId: 333,
        juego: "duelo de dados",
      },
      crearContexto(userbot),
    )) as ResultadoRetoPrivado;

    expect(resultado.resultado).toEqual({
      yaAvisado: false,
      envio: { estado: "enviado" },
    });
    expect(userbot.enviados).toHaveLength(1);
    expect(userbot.enviados[0]?.userTelegramId).toBe(333n);
    expect(userbot.enviados[0]?.texto).toContain("duelo de dados");

    expect(avisos.filas[0]).toMatchObject({
      tenantId: "t1",
      destinatarioTelegramId: 333n,
      tipo: "economia.reto_privado",
      estado: "enviado",
    });
  });

  it("funciona igual si el retado tiene el bot bloqueado", async () => {
    const avisos = new FakeAvisoPrivadoRepository();
    const manejadores = manejadoresDeEconomia({ avisos });
    const manejador = unManejador(manejadores, "economia.reto_privado");
    const userbot = new FakeUserbot();
    userbot.resultadoEnvioPrivado = { estado: "rebotado" };

    const resultado = (await manejador(
      {
        tenantId: "t1",
        retadorTelegramId: 222,
        retadoTelegramId: 333,
        juego: "trivia",
      },
      crearContexto(userbot),
    )) as ResultadoRetoPrivado;

    expect(resultado.resultado).toEqual({
      yaAvisado: false,
      envio: { estado: "rebotado" },
    });
    expect(avisos.filas[0]?.estado).toBe("rebotado");
  });

  it("lanza si falta juego", async () => {
    const manejadores = manejadoresDeEconomia({
      avisos: new FakeAvisoPrivadoRepository(),
    });
    const manejador = unManejador(manejadores, "economia.reto_privado");

    await expect(
      manejador(
        { tenantId: "t1", retadorTelegramId: 222, retadoTelegramId: 333 },
        crearContexto(new FakeUserbot()),
      ),
    ).rejects.toThrow(/juego/);
  });

  it("lanza si falta tenantId, aunque no lo listara el enunciado del bloque", async () => {
    const manejadores = manejadoresDeEconomia({
      avisos: new FakeAvisoPrivadoRepository(),
    });
    const manejador = unManejador(manejadores, "economia.reto_privado");

    await expect(
      manejador(
        { retadorTelegramId: 222, retadoTelegramId: 333, juego: "trivia" },
        crearContexto(new FakeUserbot()),
      ),
    ).rejects.toThrow(/tenantId/);
  });
});
