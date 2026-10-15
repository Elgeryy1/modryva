import type {
  AyudanteAvisoPrivadoRepository,
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
  componerReaccion,
  crearManejadoresDePersonaje,
  PERSONAJE,
  type RepositoriosDePersonaje,
} from "./personaje.js";

const logger = createLogger("personaje-test", "silent");

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
    readonly estado: Exclude<FilaAvisoPrivado["estado"], "pendiente">;
  }): Promise<void> {
    const fila = this.filas.find((f) => f.id === input.id);
    if (!fila) throw new Error(`no existe el aviso "${input.id}"`);
    this.filas = this.filas.map((f) =>
      f.id === input.id
        ? { ...f, estado: input.estado, enviadoEn: new Date() }
        : f,
    );
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

describe("PERSONAJE", () => {
  it("tiene nombre y tono, placeholder a decidir por el propietario", () => {
    expect(typeof PERSONAJE.nombre).toBe("string");
    expect(PERSONAJE.nombre.length).toBeGreaterThan(0);
    expect(typeof PERSONAJE.tono).toBe("string");
    expect(PERSONAJE.tono.length).toBeGreaterThan(0);
  });
});

describe("componerReaccion", () => {
  it("devuelve un texto en el tono del personaje para un evento conocido", () => {
    const texto = componerReaccion("buen_mensaje");
    expect(texto).not.toBeNull();
    expect(texto).toContain(PERSONAJE.nombre);
  });

  it("devuelve null para un evento sin reaccion definida", () => {
    expect(componerReaccion("evento_inventado_que_no_existe")).toBeNull();
  });

  it("nunca devuelve un texto para un evento de moderacion, aunque alguien lo intente", () => {
    // No hay ningun caso de moderacion en el switch: cualquier nombre que
    // suene a sancion cae en el `default` y no produce texto.
    expect(componerReaccion("ban")).toBeNull();
    expect(componerReaccion("warn")).toBeNull();
    expect(componerReaccion("verificacion_fallida")).toBeNull();
  });
});

describe("personaje.entregar_premio", () => {
  it("registra el aviso, lo manda por privado y marca el resultado", async () => {
    const avisos = new FakeAvisoPrivadoRepository();
    const repos: RepositoriosDePersonaje = { avisos };
    const manejadores = crearManejadoresDePersonaje(repos);
    const userbot = new FakeUserbot();
    userbot.resultadoEnvioPrivado = { estado: "enviado" };

    const manejador = unManejador(manejadores, "personaje.entregar_premio");
    const resultado = (await manejador(
      {
        tenantId: "t1",
        destinatarioTelegramId: 555,
        premio: "un huevo dorado",
      },
      crearContexto(userbot),
    )) as { estado: string };

    expect(resultado).toEqual({
      yaAvisado: false,
      envio: { estado: "enviado" },
    });
    expect(userbot.enviados).toHaveLength(1);
    expect(userbot.enviados[0]?.userTelegramId).toBe(555n);
    expect(userbot.enviados[0]?.texto).toContain(PERSONAJE.nombre);
    expect(userbot.enviados[0]?.texto).toContain("un huevo dorado");

    expect(avisos.filas).toHaveLength(1);
    expect(avisos.filas[0]?.tipo).toBe("personaje.premio");
    expect(avisos.filas[0]?.estado).toBe("enviado");
    expect(avisos.filas[0]?.destinatarioTelegramId).toBe(555n);
  });

  it("registra el rebote si el userbot dice que rebota", async () => {
    const avisos = new FakeAvisoPrivadoRepository();
    const manejadores = crearManejadoresDePersonaje({ avisos });
    const userbot = new FakeUserbot();
    userbot.resultadoEnvioPrivado = { estado: "bloqueado" };

    const manejador = unManejador(manejadores, "personaje.entregar_premio");
    const resultado = await manejador(
      { tenantId: "t1", destinatarioTelegramId: 9, premio: "x" },
      crearContexto(userbot),
    );

    expect(resultado).toEqual({
      yaAvisado: false,
      envio: { estado: "bloqueado" },
    });
    expect(avisos.filas[0]?.estado).toBe("bloqueado");
  });

  it("acepta destinatarioTelegramId como texto numerico", async () => {
    const avisos = new FakeAvisoPrivadoRepository();
    const manejadores = crearManejadoresDePersonaje({ avisos });
    const userbot = new FakeUserbot();

    const manejador = unManejador(manejadores, "personaje.entregar_premio");
    await manejador(
      { tenantId: "t1", destinatarioTelegramId: "12345", premio: "x" },
      crearContexto(userbot),
    );

    expect(userbot.enviados[0]?.userTelegramId).toBe(12345n);
  });

  it("lanza si el payload no trae premio", async () => {
    const manejadores = crearManejadoresDePersonaje({
      avisos: new FakeAvisoPrivadoRepository(),
    });
    const manejador = unManejador(manejadores, "personaje.entregar_premio");

    await expect(
      manejador(
        { tenantId: "t1", destinatarioTelegramId: 1 },
        crearContexto(new FakeUserbot()),
      ),
    ).rejects.toThrow(/premio/);
  });

  it("lanza si el payload no trae tenantId", async () => {
    const manejadores = crearManejadoresDePersonaje({
      avisos: new FakeAvisoPrivadoRepository(),
    });
    const manejador = unManejador(manejadores, "personaje.entregar_premio");

    await expect(
      manejador(
        { destinatarioTelegramId: 1, premio: "x" },
        crearContexto(new FakeUserbot()),
      ),
    ).rejects.toThrow(/tenantId/);
  });
});

describe("crearManejadoresDePersonaje", () => {
  it("tiene EXACTAMENTE las claves esperadas, ninguna de moderacion", () => {
    const catalogo = crearManejadoresDePersonaje({
      avisos: new FakeAvisoPrivadoRepository(),
    });
    expect(Object.keys(catalogo).sort()).toEqual(
      ["personaje.entregar_premio"].sort(),
    );

    // Ninguna clave puede sonar a moderacion o a suplantar a Modryva: el
    // ayudante como personaje NUNCA banea, expulsa, ni habla por el bot.
    for (const clave of Object.keys(catalogo)) {
      expect(clave).not.toMatch(/banear|expulsar|silenciar|borrar|modryva/i);
    }
  });
});
