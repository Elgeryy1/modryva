import type {
  AyudanteSolicitudRepository,
  SolicitudAyudante,
} from "@superbot/data";
import { createLogger } from "@superbot/shared";
import { describe, expect, it } from "vitest";
import {
  aJsonSeguro,
  type CatalogoDeManejadores,
  despacharLote,
} from "./despachador.js";
import { FakeUserbot } from "./fake-userbot.js";

const logger = createLogger("despachador-test", "silent");

/** En memoria, misma interfaz que la implementacion Prisma real. */
class FakeSolicitudRepository implements AyudanteSolicitudRepository {
  pendientes: SolicitudAyudante[] = [];
  hechas: { id: string; resultado: unknown }[] = [];
  fallos: { id: string; error: string; definitivo: boolean }[] = [];

  async crear(): Promise<SolicitudAyudante> {
    throw new Error("no usado en estos tests");
  }

  async reclamarLote(limite: number): Promise<readonly SolicitudAyudante[]> {
    return this.pendientes.splice(0, limite);
  }

  async marcarHecha(id: string, resultado: unknown): Promise<void> {
    // Lo que de verdad hace Prisma con una columna `Json`. Si el resultado
    // trae un `bigint` sin convertir, esto lanza igual que en produccion --
    // que es justo lo que un fake que se limita a guardar el objeto en
    // memoria no puede detectar.
    JSON.stringify(resultado);
    this.hechas.push({ id, resultado });
  }

  async marcarFallo(input: {
    readonly id: string;
    readonly error: string;
    readonly definitivo: boolean;
  }): Promise<void> {
    this.fallos.push({ ...input });
  }
}

const unaSolicitud = (tipo: string, intentos = 0): SolicitudAyudante => ({
  id: `sol-${tipo}`,
  tenantId: "t1",
  tipo,
  payload: {},
  estado: "en_proceso",
  intentos,
  resultado: null,
  error: null,
  creadaEn: new Date("2026-09-02T10:00:00.000Z"),
  reclamadaEn: null,
  resueltaEn: null,
});

describe("aJsonSeguro", () => {
  it("convierte bigint a texto, en profundidad", () => {
    expect(
      aJsonSeguro({ ids: [1n, 2n], anidado: { id: 3n }, texto: "x", n: 4 }),
    ).toEqual({ ids: ["1", "2"], anidado: { id: "3" }, texto: "x", n: 4 });
  });

  it("convierte fechas a ISO y respeta null", () => {
    expect(
      aJsonSeguro({ f: new Date("2026-09-02T10:00:00.000Z"), v: null }),
    ).toEqual({ f: "2026-09-02T10:00:00.000Z", v: null });
  });

  it("lo que devuelve siempre es serializable a JSON", () => {
    expect(() =>
      JSON.stringify(aJsonSeguro({ salidasSilenciosas: [111n, 222n] })),
    ).not.toThrow();
  });
});

describe("despacharLote", () => {
  it("guarda un resultado con bigint sin reventar al escribirlo", async () => {
    // `censo.censar_grupo` devuelve ids de Telegram, que son bigint. Sin la
    // conversion, el despachador reventaba AL GUARDAR: el efecto ya estaba
    // aplicado, el resultado se perdia, y el reintento repetia el efecto.
    const repositorio = new FakeSolicitudRepository();
    repositorio.pendientes.push(unaSolicitud("censo.censar_grupo"));

    const catalogo: CatalogoDeManejadores = {
      "censo.censar_grupo": async () => ({
        total: 2,
        salidasSilenciosas: [111n, 222n],
      }),
    };

    await despacharLote({
      repositorio,
      catalogo,
      contexto: { userbot: new FakeUserbot(), logger },
      lote: 5,
    });

    expect(repositorio.fallos).toHaveLength(0);
    expect(repositorio.hechas).toEqual([
      {
        id: "sol-censo.censar_grupo",
        resultado: { total: 2, salidasSilenciosas: ["111", "222"] },
      },
    ]);
  });

  it("un tipo desconocido falla definitivo y no se reintenta", async () => {
    const repositorio = new FakeSolicitudRepository();
    repositorio.pendientes.push(unaSolicitud("no.existe"));

    await despacharLote({
      repositorio,
      catalogo: {},
      contexto: { userbot: new FakeUserbot(), logger },
      lote: 5,
    });

    expect(repositorio.fallos).toEqual([
      {
        id: "sol-no.existe",
        error: "tipo de solicitud desconocido: no.existe",
        definitivo: true,
      },
    ]);
  });

  it("un manejador que lanza se reintenta hasta agotar los intentos", async () => {
    const repositorio = new FakeSolicitudRepository();
    repositorio.pendientes.push(unaSolicitud("x.falla", 0));
    const catalogo: CatalogoDeManejadores = {
      "x.falla": async () => {
        throw new Error("boom");
      },
    };
    const contexto = { userbot: new FakeUserbot(), logger };

    await despacharLote({ repositorio, catalogo, contexto, lote: 5 });
    expect(repositorio.fallos[0]?.definitivo).toBe(false);

    repositorio.pendientes.push(unaSolicitud("x.falla", 2));
    await despacharLote({ repositorio, catalogo, contexto, lote: 5 });
    expect(repositorio.fallos[1]?.definitivo).toBe(true);
  });
});
