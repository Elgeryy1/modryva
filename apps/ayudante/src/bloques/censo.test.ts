import type {
  AyudanteCensoRepository,
  FilaAlias,
  FilaCenso,
  MiembroCensado,
} from "@superbot/data";
import { createLogger } from "@superbot/shared";
import { describe, expect, it } from "vitest";
import type {
  CatalogoDeManejadores,
  ContextoDeManejador,
} from "../despachador.js";
import { FakeUserbot } from "../fake-userbot.js";
import type { MensajeDeHistorial, MiembroDelGrupo } from "../userbot-port.js";
import {
  calcularFantasmas,
  crearManejadoresDeCenso,
  detectarCambioDeAlias,
  type RepositoriosDeCenso,
  type ResultadoCensarGrupo,
} from "./censo.js";

const logger = createLogger("censo-test", "silent");

/** `noUncheckedIndexedAccess` marca el acceso por clave como opcional; esto deja el resto del test sin ese ruido. */
const unManejador = (catalogo: CatalogoDeManejadores, tipo: string) => {
  const manejador = catalogo[tipo];
  if (!manejador) throw new Error(`falta el manejador de tipo "${tipo}"`);
  return manejador;
};

/** En memoria, misma interfaz que la implementacion Prisma real. */
class FakeCensoRepository implements AyudanteCensoRepository {
  aplicado: {
    tenantId: string;
    chatId: string;
    miembros: readonly MiembroCensado[];
  }[] = [];
  salidasAResponder: readonly bigint[] = [];

  async aplicarCenso(input: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly miembros: readonly MiembroCensado[];
  }): Promise<{ readonly salidasSilenciosas: readonly bigint[] }> {
    this.aplicado.push({ ...input });
    return { salidasSilenciosas: this.salidasAResponder };
  }

  async listarDelGrupo(): Promise<readonly FilaCenso[]> {
    throw new Error("no usado en estos tests");
  }

  async listarPresentes(): Promise<readonly FilaCenso[]> {
    throw new Error("no usado en estos tests");
  }

  async registrarAliasSiCambio(): Promise<boolean> {
    throw new Error("no usado en estos tests");
  }

  async historialDeAlias(): Promise<readonly FilaAlias[]> {
    throw new Error("no usado en estos tests");
  }
}

const crearContexto = (userbot: FakeUserbot): ContextoDeManejador => ({
  userbot,
  logger,
});

const filaCenso = (parcial: Partial<FilaCenso>): FilaCenso => ({
  id: "id-1",
  tenantId: "t1",
  chatId: "c1",
  userTelegramId: 1n,
  alias: null,
  nombre: null,
  presente: true,
  vistoEn: new Date(),
  ultimaConexionEn: null,
  ...parcial,
});

describe("censo.censar_grupo", () => {
  it("lista miembros del userbot, los aplica al repositorio y devuelve total y salidas", async () => {
    const censo = new FakeCensoRepository();
    censo.salidasAResponder = [999n];
    const repos: RepositoriosDeCenso = { censo };
    const manejadores = crearManejadoresDeCenso(repos);

    const userbot = new FakeUserbot();
    const miembros: MiembroDelGrupo[] = [
      {
        userTelegramId: 111n,
        alias: "fulano",
        nombre: "Fulano",
        ultimaConexionEn: null,
      },
      {
        userTelegramId: 222n,
        alias: null,
        nombre: "Mengano",
        ultimaConexionEn: new Date("2026-01-01T00:00:00Z"),
      },
    ];
    userbot.miembros.set("-1001", miembros);

    const manejador = unManejador(manejadores, "censo.censar_grupo");
    const resultado = (await manejador(
      { tenantId: "t1", chatId: "-1001" },
      crearContexto(userbot),
    )) as ResultadoCensarGrupo;

    expect(resultado.total).toBe(2);
    expect(resultado.salidasSilenciosas).toEqual([999n]);

    expect(censo.aplicado).toHaveLength(1);
    expect(censo.aplicado[0]?.tenantId).toBe("t1");
    expect(censo.aplicado[0]?.chatId).toBe("-1001");
    expect(censo.aplicado[0]?.miembros).toEqual([
      {
        chatId: "-1001",
        userTelegramId: 111n,
        alias: "fulano",
        nombre: "Fulano",
        ultimaConexionEn: null,
      },
      {
        chatId: "-1001",
        userTelegramId: 222n,
        alias: null,
        nombre: "Mengano",
        ultimaConexionEn: new Date("2026-01-01T00:00:00Z"),
      },
    ]);
  });

  it("acepta chatId como texto numerico ademas de como number", async () => {
    const censo = new FakeCensoRepository();
    const manejadores = crearManejadoresDeCenso({ censo });
    const userbot = new FakeUserbot();
    userbot.miembros.set("555", []);

    const manejador = unManejador(manejadores, "censo.censar_grupo");
    const resultado = (await manejador(
      { tenantId: "t1", chatId: 555 },
      crearContexto(userbot),
    )) as ResultadoCensarGrupo;

    expect(resultado.total).toBe(0);
    expect(resultado.salidasSilenciosas).toEqual([]);
    expect(censo.aplicado[0]?.chatId).toBe("555");
  });

  it("lanza si falta tenantId", async () => {
    const manejadores = crearManejadoresDeCenso({
      censo: new FakeCensoRepository(),
    });
    const manejador = unManejador(manejadores, "censo.censar_grupo");

    await expect(
      manejador({ chatId: "-1001" }, crearContexto(new FakeUserbot())),
    ).rejects.toThrow(/tenantId/);
  });

  it("lanza si chatId no es un entero valido", async () => {
    const manejadores = crearManejadoresDeCenso({
      censo: new FakeCensoRepository(),
    });
    const manejador = unManejador(manejadores, "censo.censar_grupo");

    await expect(
      manejador(
        { tenantId: "t1", chatId: "no-es-un-id" },
        crearContexto(new FakeUserbot()),
      ),
    ).rejects.toThrow(/chatId/);
  });
});

describe("calcularFantasmas", () => {
  it("devuelve solo a quien esta presente y sin actividad conocida", () => {
    const miembros = [
      filaCenso({ userTelegramId: 1n, presente: true }),
      filaCenso({ userTelegramId: 2n, presente: true }),
      filaCenso({ userTelegramId: 3n, presente: false }),
    ];
    const idsConActividad = new Set(["2"]);

    const fantasmas = calcularFantasmas(miembros, idsConActividad);

    expect(fantasmas.map((f) => f.userTelegramId)).toEqual([1n]);
  });

  it("no considera fantasma a quien ya no esta presente, aunque no tenga actividad", () => {
    const miembros = [filaCenso({ userTelegramId: 9n, presente: false })];

    const fantasmas = calcularFantasmas(miembros, new Set());

    expect(fantasmas).toEqual([]);
  });

  it("devuelve la lista vacia si todos tienen actividad", () => {
    const miembros = [
      filaCenso({ userTelegramId: 1n, presente: true }),
      filaCenso({ userTelegramId: 2n, presente: true }),
    ];

    const fantasmas = calcularFantasmas(miembros, new Set(["1", "2"]));

    expect(fantasmas).toEqual([]);
  });
});

describe("detectarCambioDeAlias", () => {
  it("de null a un alias cuenta como cambio", () => {
    expect(detectarCambioDeAlias(null, "fulano")).toBe(true);
  });

  it("de un alias a null cuenta como cambio", () => {
    expect(detectarCambioDeAlias("fulano", null)).toBe(true);
  });

  it("de null a null no cuenta como cambio", () => {
    expect(detectarCambioDeAlias(null, null)).toBe(false);
  });

  it("mismo texto con distinta capitalizacion no cuenta como cambio", () => {
    expect(detectarCambioDeAlias("Fulano", "fulano")).toBe(false);
    expect(detectarCambioDeAlias("FULANO", "fulano")).toBe(false);
  });

  it("un texto distinto de verdad si cuenta como cambio", () => {
    expect(detectarCambioDeAlias("fulano", "mengano")).toBe(true);
  });
});

describe("censo.buscar_historial", () => {
  it("delega en userbot.buscarEnHistorial y devuelve los mensajes tal cual", async () => {
    const manejadores = crearManejadoresDeCenso({
      censo: new FakeCensoRepository(),
    });
    const userbot = new FakeUserbot();
    const mensajes: MensajeDeHistorial[] = [
      {
        messageId: 10,
        userTelegramId: 111n,
        texto: "hola grupo",
        fecha: new Date("2026-01-01T00:00:00Z"),
        borradoPorAdmin: false,
      },
    ];
    userbot.historial.set("-1001", mensajes);

    const manejador = unManejador(manejadores, "censo.buscar_historial");
    const resultado = (await manejador(
      { chatId: "-1001", texto: "hola", deUsuario: null, limite: 10 },
      crearContexto(userbot),
    )) as readonly MensajeDeHistorial[];

    expect(resultado).toEqual(mensajes);
  });

  it("acepta deUsuario nulo y filtra por texto igual que el userbot", async () => {
    const manejadores = crearManejadoresDeCenso({
      censo: new FakeCensoRepository(),
    });
    const userbot = new FakeUserbot();
    userbot.historial.set("-1001", [
      {
        messageId: 1,
        userTelegramId: 111n,
        texto: "buenas tardes",
        fecha: new Date(),
        borradoPorAdmin: false,
      },
      {
        messageId: 2,
        userTelegramId: 222n,
        texto: "hola a todos",
        fecha: new Date(),
        borradoPorAdmin: false,
      },
    ]);

    const manejador = unManejador(manejadores, "censo.buscar_historial");
    const resultado = (await manejador(
      { chatId: "-1001", texto: "hola", deUsuario: null, limite: 10 },
      crearContexto(userbot),
    )) as readonly MensajeDeHistorial[];

    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.messageId).toBe(2);
  });

  it("acepta deUsuario como bigint (via number) y limite como texto numerico", async () => {
    const manejadores = crearManejadoresDeCenso({
      censo: new FakeCensoRepository(),
    });
    const userbot = new FakeUserbot();
    userbot.historial.set("-1001", [
      {
        messageId: 1,
        userTelegramId: 111n,
        texto: "a",
        fecha: new Date(),
        borradoPorAdmin: false,
      },
      {
        messageId: 2,
        userTelegramId: 222n,
        texto: "b",
        fecha: new Date(),
        borradoPorAdmin: false,
      },
    ]);

    const manejador = unManejador(manejadores, "censo.buscar_historial");
    const resultado = (await manejador(
      { chatId: "-1001", texto: null, deUsuario: 222, limite: "5" },
      crearContexto(userbot),
    )) as readonly MensajeDeHistorial[];

    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.userTelegramId).toBe(222n);
  });

  it("nunca expone campos de foto o video: el tipo de retorno no los tiene", async () => {
    const manejadores = crearManejadoresDeCenso({
      censo: new FakeCensoRepository(),
    });
    const userbot = new FakeUserbot();
    const mensaje: MensajeDeHistorial = {
      messageId: 1,
      userTelegramId: 111n,
      texto: "solo texto",
      fecha: new Date(),
      borradoPorAdmin: false,
    };
    userbot.historial.set("-1001", [mensaje]);

    const manejador = unManejador(manejadores, "censo.buscar_historial");
    const resultado = (await manejador(
      { chatId: "-1001", texto: null, deUsuario: null, limite: 10 },
      crearContexto(userbot),
    )) as readonly MensajeDeHistorial[];

    expect(Object.keys(resultado[0] ?? {}).sort()).toEqual(
      [
        "borradoPorAdmin",
        "fecha",
        "messageId",
        "texto",
        "userTelegramId",
      ].sort(),
    );
  });

  it("lanza si falta chatId", async () => {
    const manejadores = crearManejadoresDeCenso({
      censo: new FakeCensoRepository(),
    });
    const manejador = unManejador(manejadores, "censo.buscar_historial");

    await expect(
      manejador(
        { texto: null, deUsuario: null, limite: 10 },
        crearContexto(new FakeUserbot()),
      ),
    ).rejects.toThrow(/chatId/);
  });
});
