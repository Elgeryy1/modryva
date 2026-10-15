import type {
  AyudanteCensoRepository,
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
  calcularMapaDeHoras,
  filtrarEnLinea,
  manejadoresDeDatos,
  type RepositoriosDeDatos,
} from "./datos.js";

const logger = createLogger("datos-test", "silent");

/** `noUncheckedIndexedAccess` marca el acceso por clave como opcional; esto deja el resto del test sin ese ruido. */
const unManejador = (catalogo: CatalogoDeManejadores, tipo: string) => {
  const manejador = catalogo[tipo];
  if (!manejador) throw new Error(`falta el manejador de tipo "${tipo}"`);
  return manejador;
};

/** En memoria, misma interfaz que la implementacion Prisma real. */
class FakeCensoRepository implements AyudanteCensoRepository {
  delGrupo: readonly FilaCenso[] = [];
  presentes: readonly FilaCenso[] = [];

  async aplicarCenso(): Promise<{
    readonly salidasSilenciosas: readonly bigint[];
  }> {
    throw new Error("no usado en estos tests");
  }

  async listarDelGrupo(): Promise<readonly FilaCenso[]> {
    return this.delGrupo;
  }

  async listarPresentes(): Promise<readonly FilaCenso[]> {
    return this.presentes;
  }

  async registrarAliasSiCambio(): Promise<boolean> {
    throw new Error("no usado en estos tests");
  }

  async historialDeAlias(): Promise<readonly FilaAlias[]> {
    throw new Error("no usado en estos tests");
  }
}

const crearContexto = (): ContextoDeManejador => ({
  userbot: new FakeUserbot(),
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

// ---------------------------------------------------------------------------
// calcularMapaDeHoras -- pura
// ---------------------------------------------------------------------------

describe("calcularMapaDeHoras", () => {
  it("cuenta cuantas veces cae cada hora UTC", () => {
    const vistos = [
      { ultimaConexionEn: new Date("2026-01-01T08:00:00Z") },
      { ultimaConexionEn: new Date("2026-01-02T08:30:00Z") },
      { ultimaConexionEn: new Date("2026-01-01T23:00:00Z") },
    ];

    const mapa = calcularMapaDeHoras(vistos);

    expect(mapa[8]).toBe(2);
    expect(mapa[23]).toBe(1);
  });

  it("devuelve las 24 horas, incluidas las que no tienen actividad", () => {
    const mapa = calcularMapaDeHoras([]);

    expect(Object.keys(mapa)).toHaveLength(24);
    expect(mapa[0]).toBe(0);
    expect(mapa[12]).toBe(0);
    expect(mapa[23]).toBe(0);
  });

  it("usa la hora UTC, no la hora local de la maquina que ejecuta", () => {
    // 23:30 UTC es 00:30 del dia siguiente en muchas zonas horarias locales;
    // si el calculo usara getHours() en vez de getUTCHours() esto fallaria
    // segun donde se ejecute la suite.
    const mapa = calcularMapaDeHoras([
      { ultimaConexionEn: new Date("2026-01-01T23:30:00Z") },
    ]);

    expect(mapa[23]).toBe(1);
    expect(mapa[0]).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// filtrarEnLinea -- pura
// ---------------------------------------------------------------------------

describe("filtrarEnLinea", () => {
  const ahora = new Date("2026-01-01T12:00:00Z");

  it("incluye a quien se conecto dentro de la ventana", () => {
    const dentro = filaCenso({
      userTelegramId: 1n,
      ultimaConexionEn: new Date("2026-01-01T11:55:00Z"),
    });

    const resultado = filtrarEnLinea([dentro], 10, ahora);

    expect(resultado).toEqual([dentro]);
  });

  it("excluye a quien se conecto fuera de la ventana", () => {
    const fuera = filaCenso({
      userTelegramId: 2n,
      ultimaConexionEn: new Date("2026-01-01T11:30:00Z"),
    });

    const resultado = filtrarEnLinea([fuera], 10, ahora);

    expect(resultado).toEqual([]);
  });

  it("incluye el borde exacto de la ventana", () => {
    const enElBorde = filaCenso({
      userTelegramId: 3n,
      ultimaConexionEn: new Date("2026-01-01T11:50:00Z"),
    });

    const resultado = filtrarEnLinea([enElBorde], 10, ahora);

    expect(resultado).toEqual([enElBorde]);
  });

  it("excluye a quien no tiene ultimaConexionEn", () => {
    const sinConexion = filaCenso({
      userTelegramId: 4n,
      ultimaConexionEn: null,
    });

    const resultado = filtrarEnLinea([sinConexion], 10, ahora);

    expect(resultado).toEqual([]);
  });

  it("excluye una conexion futura respecto a 'ahora' (reloj desincronizado)", () => {
    const futura = filaCenso({
      userTelegramId: 5n,
      ultimaConexionEn: new Date("2026-01-01T12:05:00Z"),
    });

    const resultado = filtrarEnLinea([futura], 10, ahora);

    expect(resultado).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// datos.mapa_de_horas
// ---------------------------------------------------------------------------

describe("datos.mapa_de_horas", () => {
  it("filtra a quien no tiene ultimaConexionEn y cuenta el resto por hora", async () => {
    const censo = new FakeCensoRepository();
    censo.delGrupo = [
      filaCenso({
        userTelegramId: 1n,
        ultimaConexionEn: new Date("2026-01-01T08:00:00Z"),
      }),
      filaCenso({ userTelegramId: 2n, ultimaConexionEn: null }),
      filaCenso({
        userTelegramId: 3n,
        ultimaConexionEn: new Date("2026-01-02T08:15:00Z"),
        presente: false,
      }),
    ];
    const repos: RepositoriosDeDatos = { censo };
    const manejadores = manejadoresDeDatos(repos);

    const manejador = unManejador(manejadores, "datos.mapa_de_horas");
    const resultado = (await manejador(
      { tenantId: "t1", chatId: "-1001" },
      crearContexto(),
    )) as Record<number, number>;

    expect(resultado[8]).toBe(2);
    expect(resultado[0]).toBe(0);
  });

  it("incluye a quien ya no esta presente: su hora de actividad sigue siendo un dato valido", async () => {
    const censo = new FakeCensoRepository();
    censo.delGrupo = [
      filaCenso({
        userTelegramId: 9n,
        presente: false,
        ultimaConexionEn: new Date("2026-01-01T05:00:00Z"),
      }),
    ];
    const manejadores = manejadoresDeDatos({ censo });

    const manejador = unManejador(manejadores, "datos.mapa_de_horas");
    const resultado = (await manejador(
      { tenantId: "t1", chatId: "-1001" },
      crearContexto(),
    )) as Record<number, number>;

    expect(resultado[5]).toBe(1);
  });

  it("lanza si falta tenantId", async () => {
    const manejadores = manejadoresDeDatos({
      censo: new FakeCensoRepository(),
    });
    const manejador = unManejador(manejadores, "datos.mapa_de_horas");

    await expect(
      manejador({ chatId: "-1001" }, crearContexto()),
    ).rejects.toThrow(/tenantId/);
  });

  it("lanza si falta chatId", async () => {
    const manejadores = manejadoresDeDatos({
      censo: new FakeCensoRepository(),
    });
    const manejador = unManejador(manejadores, "datos.mapa_de_horas");

    await expect(
      manejador({ tenantId: "t1" }, crearContexto()),
    ).rejects.toThrow(/chatId/);
  });
});

// ---------------------------------------------------------------------------
// datos.quien_esta_en_linea
// ---------------------------------------------------------------------------

describe("datos.quien_esta_en_linea", () => {
  it("usa listarPresentes y filtra por la ventana pedida, con 'ahora' fijado en el payload", async () => {
    const ahoraFijo = "2026-01-01T12:00:00.000Z";
    const censo = new FakeCensoRepository();
    censo.presentes = [
      filaCenso({
        userTelegramId: 1n,
        ultimaConexionEn: new Date("2026-01-01T11:55:00Z"),
      }),
      filaCenso({
        userTelegramId: 2n,
        ultimaConexionEn: new Date("2026-01-01T10:00:00Z"),
      }),
    ];
    const manejadores = manejadoresDeDatos({ censo });

    const manejador = unManejador(manejadores, "datos.quien_esta_en_linea");
    const resultado = (await manejador(
      {
        tenantId: "t1",
        chatId: "-1001",
        minutosParaConsiderarEnLinea: 10,
        ahora: ahoraFijo,
      },
      crearContexto(),
    )) as readonly FilaCenso[];

    expect(resultado.map((f) => f.userTelegramId)).toEqual([1n]);
  });

  it("sin 'ahora' en el payload usa la hora real (produccion normal)", async () => {
    const censo = new FakeCensoRepository();
    censo.presentes = [
      filaCenso({ userTelegramId: 1n, ultimaConexionEn: new Date() }),
    ];
    const manejadores = manejadoresDeDatos({ censo });

    const manejador = unManejador(manejadores, "datos.quien_esta_en_linea");
    const resultado = (await manejador(
      { tenantId: "t1", chatId: "-1001", minutosParaConsiderarEnLinea: 5 },
      crearContexto(),
    )) as readonly FilaCenso[];

    expect(resultado).toHaveLength(1);
  });

  it("acepta minutosParaConsiderarEnLinea como texto numerico", async () => {
    const censo = new FakeCensoRepository();
    censo.presentes = [
      filaCenso({
        userTelegramId: 1n,
        ultimaConexionEn: new Date("2026-01-01T11:55:00Z"),
      }),
    ];
    const manejadores = manejadoresDeDatos({ censo });

    const manejador = unManejador(manejadores, "datos.quien_esta_en_linea");
    const resultado = (await manejador(
      {
        tenantId: "t1",
        chatId: "-1001",
        minutosParaConsiderarEnLinea: "10",
        ahora: "2026-01-01T12:00:00.000Z",
      },
      crearContexto(),
    )) as readonly FilaCenso[];

    expect(resultado).toHaveLength(1);
  });

  it("lanza si minutosParaConsiderarEnLinea no es un entero valido", async () => {
    const manejadores = manejadoresDeDatos({
      censo: new FakeCensoRepository(),
    });
    const manejador = unManejador(manejadores, "datos.quien_esta_en_linea");

    await expect(
      manejador(
        { tenantId: "t1", chatId: "-1001", minutosParaConsiderarEnLinea: "no" },
        crearContexto(),
      ),
    ).rejects.toThrow(/minutosParaConsiderarEnLinea/);
  });

  it("lanza si 'ahora' viene pero no es una fecha valida", async () => {
    const manejadores = manejadoresDeDatos({
      censo: new FakeCensoRepository(),
    });
    const manejador = unManejador(manejadores, "datos.quien_esta_en_linea");

    await expect(
      manejador(
        {
          tenantId: "t1",
          chatId: "-1001",
          minutosParaConsiderarEnLinea: 10,
          ahora: "no-es-una-fecha",
        },
        crearContexto(),
      ),
    ).rejects.toThrow(/ahora/);
  });

  it("lanza si falta tenantId", async () => {
    const manejadores = manejadoresDeDatos({
      censo: new FakeCensoRepository(),
    });
    const manejador = unManejador(manejadores, "datos.quien_esta_en_linea");

    await expect(
      manejador(
        { chatId: "-1001", minutosParaConsiderarEnLinea: 10 },
        crearContexto(),
      ),
    ).rejects.toThrow(/tenantId/);
  });
});
