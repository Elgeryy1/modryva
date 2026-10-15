import type {
  AyudanteCensoRepository,
  AyudanteIdentidadRepository,
  CoincidenciaDeAvatar,
  FilaAlias,
  FilaCenso,
} from "@superbot/data";
import { createLogger } from "@superbot/shared";
import { describe, expect, it } from "vitest";
import type {
  CatalogoDeManejadores,
  ContextoDeManejador,
} from "../despachador.js";
import { FakeUserbot } from "../fake-userbot.js";
import {
  crearManejadoresDeIdentidad,
  evaluarRiesgoDeIngreso,
  fichaParaPropietario,
  type RepositoriosDeIdentidad,
} from "./identidad.js";

const logger = createLogger("identidad-test", "silent");

/** `noUncheckedIndexedAccess` marca el acceso por clave como opcional; esto deja el resto del test sin ese ruido. */
const unManejador = (catalogo: CatalogoDeManejadores, tipo: string) => {
  const manejador = catalogo[tipo];
  if (!manejador) throw new Error(`falta el manejador de tipo "${tipo}"`);
  return manejador;
};

/** En memoria, misma interfaz que la implementacion Prisma real. */
class FakeIdentidadRepository implements AyudanteIdentidadRepository {
  avatares: { telegramId: bigint; hash: string }[] = [];

  async registrarAvatar(input: {
    readonly telegramId: bigint;
    readonly hash: string;
  }): Promise<void> {
    const yaEstaba = this.avatares.some(
      (fila) =>
        fila.telegramId === input.telegramId && fila.hash === input.hash,
    );
    if (!yaEstaba) this.avatares.push({ ...input });
  }

  async buscarCoincidencias(input: {
    readonly telegramId: bigint;
    readonly hash: string;
  }): Promise<readonly CoincidenciaDeAvatar[]> {
    return this.avatares
      .filter(
        (fila) =>
          fila.hash === input.hash && fila.telegramId !== input.telegramId,
      )
      .map((fila) => ({
        telegramId: fila.telegramId,
        hash: fila.hash,
        detectadoEn: new Date(),
      }));
  }
}

/** Solo implementa lo que este bloque usa: `registrarAliasSiCambio`. El resto no hace falta para estos tests. */
class FakeCensoRepository implements AyudanteCensoRepository {
  aliasRegistrados: {
    tenantId: string;
    chatId: string;
    userTelegramId: bigint;
    alias: string | null;
  }[] = [];

  async aplicarCenso(): Promise<{
    readonly salidasSilenciosas: readonly bigint[];
  }> {
    throw new Error("no usado en estos tests");
  }

  async listarDelGrupo(): Promise<readonly FilaCenso[]> {
    throw new Error("no usado en estos tests");
  }

  async listarPresentes(): Promise<readonly FilaCenso[]> {
    throw new Error("no usado en estos tests");
  }

  async registrarAliasSiCambio(input: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly userTelegramId: bigint;
    readonly alias: string | null;
  }): Promise<boolean> {
    const ultimo = [...this.aliasRegistrados]
      .reverse()
      .find(
        (fila) =>
          fila.tenantId === input.tenantId &&
          fila.chatId === input.chatId &&
          fila.userTelegramId === input.userTelegramId,
      );
    if (ultimo && ultimo.alias === input.alias) return false;
    this.aliasRegistrados.push({ ...input });
    return true;
  }

  async historialDeAlias(): Promise<readonly FilaAlias[]> {
    throw new Error("no usado en estos tests");
  }
}

const crearContexto = (userbot: FakeUserbot): ContextoDeManejador => ({
  userbot,
  logger,
});

describe("evaluarRiesgoDeIngreso", () => {
  it("da puntuacion alta con varias señales para una cuenta nueva sin foto y sin chats en comun", () => {
    const resultado = evaluarRiesgoDeIngreso({
      antiguedadEstimadaDias: 1,
      tieneFoto: false,
      chatsEnComun: 0,
      esPremium: false,
    });

    expect(resultado.puntuacion).toBeGreaterThanOrEqual(70);
    expect(resultado.señales.length).toBeGreaterThanOrEqual(3);
    expect(resultado.señales).toContain("cuenta creada hace menos de 3 días");
    expect(resultado.señales).toContain("sin foto de perfil");
    expect(resultado.señales).toContain("cero chats en común");
  });

  it("da puntuacion cero y sin señales para una cuenta antigua, con foto y con chats en comun", () => {
    const resultado = evaluarRiesgoDeIngreso({
      antiguedadEstimadaDias: 400,
      tieneFoto: true,
      chatsEnComun: 5,
      esPremium: false,
    });

    expect(resultado.puntuacion).toBe(0);
    expect(resultado.señales).toEqual([]);
  });

  it("trata la antiguedad desconocida como una señal mas debil que una cuenta confirmada como nueva", () => {
    const desconocida = evaluarRiesgoDeIngreso({
      antiguedadEstimadaDias: null,
      tieneFoto: true,
      chatsEnComun: 5,
      esPremium: false,
    });
    const nueva = evaluarRiesgoDeIngreso({
      antiguedadEstimadaDias: 1,
      tieneFoto: true,
      chatsEnComun: 5,
      esPremium: false,
    });

    expect(desconocida.puntuacion).toBeGreaterThan(0);
    expect(desconocida.puntuacion).toBeLessThan(nueva.puntuacion);
  });

  it("un solo chat en comun pesa menos que cero chats en comun", () => {
    const cero = evaluarRiesgoDeIngreso({
      antiguedadEstimadaDias: 400,
      tieneFoto: true,
      chatsEnComun: 0,
      esPremium: false,
    });
    const uno = evaluarRiesgoDeIngreso({
      antiguedadEstimadaDias: 400,
      tieneFoto: true,
      chatsEnComun: 1,
      esPremium: false,
    });

    expect(uno.puntuacion).toBeGreaterThan(0);
    expect(uno.puntuacion).toBeLessThan(cero.puntuacion);
  });

  it("premium resta puntuacion sin bajar de cero", () => {
    const sinPremium = evaluarRiesgoDeIngreso({
      antiguedadEstimadaDias: 400,
      tieneFoto: true,
      chatsEnComun: 5,
      esPremium: false,
    });
    const conPremium = evaluarRiesgoDeIngreso({
      antiguedadEstimadaDias: 400,
      tieneFoto: true,
      chatsEnComun: 5,
      esPremium: true,
    });

    expect(sinPremium.puntuacion).toBe(0);
    expect(conPremium.puntuacion).toBe(0);
  });

  it("premium atenua pero no borra las señales de una cuenta sospechosa", () => {
    const resultado = evaluarRiesgoDeIngreso({
      antiguedadEstimadaDias: 1,
      tieneFoto: false,
      chatsEnComun: 0,
      esPremium: true,
    });

    expect(resultado.puntuacion).toBe(40 + 15 + 25 - 10);
    expect(resultado.señales.length).toBe(3);
  });
});

describe("identidad.detectar_multicuenta", () => {
  it("registra el hash y devuelve las cuentas que ya lo llevaron", async () => {
    const identidad = new FakeIdentidadRepository();
    const censo = new FakeCensoRepository();
    const repos: RepositoriosDeIdentidad = { identidad, censo };
    const manejadores = crearManejadoresDeIdentidad(repos);

    // Otra cuenta ya registro este mismo hash antes.
    await identidad.registrarAvatar({
      telegramId: 111n,
      hash: "hash-compartido",
    });

    const userbot = new FakeUserbot();
    userbot.avatarHashes.set("222", "hash-compartido");

    const manejador = unManejador(
      manejadores,
      "identidad.detectar_multicuenta",
    );
    const resultado = (await manejador(
      { chatId: 999, userTelegramId: 222 },
      crearContexto(userbot),
    )) as {
      hash: string | null;
      coincidencias: readonly CoincidenciaDeAvatar[];
    };

    expect(resultado.hash).toBe("hash-compartido");
    expect(resultado.coincidencias).toHaveLength(1);
    expect(resultado.coincidencias[0]?.telegramId).toBe(111n);
    expect(identidad.avatares).toContainEqual({
      telegramId: 222n,
      hash: "hash-compartido",
    });
  });

  it("devuelve un resultado vacio sin tocar el repositorio cuando no hay foto", async () => {
    const identidad = new FakeIdentidadRepository();
    const censo = new FakeCensoRepository();
    const manejadores = crearManejadoresDeIdentidad({ identidad, censo });

    const userbot = new FakeUserbot();
    // Sin entrada en avatarHashes -> FakeUserbot.obtenerHashAvatar devuelve null.

    const manejador = unManejador(
      manejadores,
      "identidad.detectar_multicuenta",
    );
    const resultado = (await manejador(
      { chatId: 999, userTelegramId: 333 },
      crearContexto(userbot),
    )) as {
      hash: string | null;
      coincidencias: readonly CoincidenciaDeAvatar[];
    };

    expect(resultado).toEqual({ hash: null, coincidencias: [] });
    expect(identidad.avatares).toHaveLength(0);
  });

  it("acepta ids como texto numerico ademas de como number", async () => {
    const identidad = new FakeIdentidadRepository();
    const censo = new FakeCensoRepository();
    const manejadores = crearManejadoresDeIdentidad({ identidad, censo });

    const userbot = new FakeUserbot();
    userbot.avatarHashes.set("444", "hash-x");

    const manejador = unManejador(
      manejadores,
      "identidad.detectar_multicuenta",
    );
    const resultado = (await manejador(
      { chatId: "999", userTelegramId: "444" },
      crearContexto(userbot),
    )) as {
      hash: string | null;
      coincidencias: readonly CoincidenciaDeAvatar[];
    };

    expect(resultado.hash).toBe("hash-x");
  });

  it("lanza si el payload no trae userTelegramId", async () => {
    const manejadores = crearManejadoresDeIdentidad({
      identidad: new FakeIdentidadRepository(),
      censo: new FakeCensoRepository(),
    });
    const manejador = unManejador(
      manejadores,
      "identidad.detectar_multicuenta",
    );

    await expect(
      manejador({ chatId: 1 }, crearContexto(new FakeUserbot())),
    ).rejects.toThrow(/userTelegramId/);
  });
});

describe("identidad.registrar_cambio_alias", () => {
  it("delega en el censo y dice si hubo cambio", async () => {
    const censo = new FakeCensoRepository();
    const manejadores = crearManejadoresDeIdentidad({
      identidad: new FakeIdentidadRepository(),
      censo,
    });
    const manejador = unManejador(
      manejadores,
      "identidad.registrar_cambio_alias",
    );
    const contexto = crearContexto(new FakeUserbot());

    const primero = await manejador(
      { tenantId: "t1", chatId: "c1", userTelegramId: 555, alias: "nuevo" },
      contexto,
    );
    expect(primero).toEqual({ cambio: true });

    const repetido = await manejador(
      { tenantId: "t1", chatId: "c1", userTelegramId: 555, alias: "nuevo" },
      contexto,
    );
    expect(repetido).toEqual({ cambio: false });

    expect(censo.aliasRegistrados).toEqual([
      { tenantId: "t1", chatId: "c1", userTelegramId: 555n, alias: "nuevo" },
    ]);
  });

  it("acepta alias nulo", async () => {
    const censo = new FakeCensoRepository();
    const manejadores = crearManejadoresDeIdentidad({
      identidad: new FakeIdentidadRepository(),
      censo,
    });
    const manejador = unManejador(
      manejadores,
      "identidad.registrar_cambio_alias",
    );

    const resultado = await manejador(
      { tenantId: "t1", chatId: "c1", userTelegramId: 555, alias: null },
      crearContexto(new FakeUserbot()),
    );
    expect(resultado).toEqual({ cambio: true });
  });

  it("lanza si falta tenantId", async () => {
    const manejadores = crearManejadoresDeIdentidad({
      identidad: new FakeIdentidadRepository(),
      censo: new FakeCensoRepository(),
    });
    const manejador = unManejador(
      manejadores,
      "identidad.registrar_cambio_alias",
    );

    await expect(
      manejador(
        { chatId: "c1", userTelegramId: 555, alias: "x" },
        crearContexto(new FakeUserbot()),
      ),
    ).rejects.toThrow(/tenantId/);
  });
});

describe("fichaParaPropietario", () => {
  it("delega en userbot.obtenerFichaCompleta", async () => {
    const userbot = new FakeUserbot();
    userbot.fichas.set("777", {
      userTelegramId: 777n,
      bio: "hola",
      chatsEnComun: 3,
      esPremium: true,
      antiguedadEstimadaDias: 500,
      tieneFoto: true,
    });

    const ficha = await fichaParaPropietario(userbot, 777n);

    expect(ficha.bio).toBe("hola");
    expect(ficha.chatsEnComun).toBe(3);
  });
});
