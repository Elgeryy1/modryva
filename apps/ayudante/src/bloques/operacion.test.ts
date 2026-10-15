import type {
  AyudanteWatchdogRepository,
  MedicionWatchdog,
} from "@superbot/data";
import { createLogger } from "@superbot/shared";
import { describe, expect, it } from "vitest";
import type {
  CatalogoDeManejadores,
  ContextoDeManejador,
} from "../despachador.js";
import { FakeUserbot } from "../fake-userbot.js";
import {
  decidirSiAlertarPorCaida,
  manejadoresDeOperacion,
  type RepositoriosDeOperacion,
  type ResultadoSondaComando,
  type ResultadoWatchdogPing,
  UMBRAL_CAIDAS_CONSECUTIVAS,
  UMBRAL_LATENCIA_MS,
} from "./operacion.js";

const logger = createLogger("operacion-test", "silent");

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

/** En memoria, misma interfaz que la implementacion Prisma real. */
class FakeWatchdogRepository implements AyudanteWatchdogRepository {
  mediciones: MedicionWatchdog[] = [];

  async registrar(input: {
    readonly latenciaMs: number | null;
    readonly ok: boolean;
  }): Promise<void> {
    // Mas reciente al principio, igual que promete `ultimas` en la
    // implementacion real (`orderBy: { medidoEn: "desc" }`).
    this.mediciones.unshift({
      medidoEn: new Date(),
      latenciaMs: input.latenciaMs,
      ok: input.ok,
    });
  }

  async ultimas(n: number): Promise<readonly MedicionWatchdog[]> {
    return this.mediciones.slice(0, n);
  }
}

describe("decidirSiAlertarPorCaida", () => {
  const medicion = (ok: boolean): MedicionWatchdog => ({
    medidoEn: new Date(),
    latenciaMs: ok ? 100 : null,
    ok,
  });

  it("alerta cuando las ultimas mediciones seguidas fallaron", () => {
    const mediciones = Array.from({ length: UMBRAL_CAIDAS_CONSECUTIVAS }, () =>
      medicion(false),
    );
    expect(decidirSiAlertarPorCaida(mediciones)).toBe(true);
  });

  it("no alerta por un fallo puntual entre mediciones buenas", () => {
    const mediciones = [medicion(false), medicion(true), medicion(true)];
    expect(decidirSiAlertarPorCaida(mediciones)).toBe(false);
  });

  it("no alerta si hay menos mediciones que el umbral, aunque todas fallen", () => {
    const mediciones = [medicion(false), medicion(false)];
    expect(decidirSiAlertarPorCaida(mediciones)).toBe(false);
  });

  it("no alerta si todas las mediciones estan bien", () => {
    const mediciones = Array.from({ length: UMBRAL_CAIDAS_CONSECUTIVAS }, () =>
      medicion(true),
    );
    expect(decidirSiAlertarPorCaida(mediciones)).toBe(false);
  });

  it("solo mira las mas recientes, no toda la lista", () => {
    // Las tres mas recientes van bien; hay fallos mas atras en el historial.
    const mediciones = [
      medicion(true),
      medicion(true),
      medicion(true),
      medicion(false),
      medicion(false),
      medicion(false),
    ];
    expect(decidirSiAlertarPorCaida(mediciones)).toBe(false);
  });
});

describe("operacion.watchdog_ping", () => {
  it("registra la medicion y no alerta cuando todo va bien", async () => {
    const watchdog = new FakeWatchdogRepository();
    const repos: RepositoriosDeOperacion = { watchdog };
    const manejadores = manejadoresDeOperacion(repos);
    const manejador = unManejador(manejadores, "operacion.watchdog_ping");

    const userbot = new FakeUserbot();
    userbot.pingOk = true;
    userbot.latenciaMs = 50;

    const resultado = (await manejador(
      { chatId: 123 },
      crearContexto(userbot),
    )) as ResultadoWatchdogPing;

    expect(resultado).toEqual({
      ok: true,
      latenciaMs: 50,
      alerta: false,
      motivo: null,
    });
    expect(watchdog.mediciones).toHaveLength(1);
    expect(watchdog.mediciones[0]).toMatchObject({ ok: true, latenciaMs: 50 });
  });

  it("alerta cuando el bot no responde", async () => {
    const watchdog = new FakeWatchdogRepository();
    const manejadores = manejadoresDeOperacion({ watchdog });
    const manejador = unManejador(manejadores, "operacion.watchdog_ping");

    const userbot = new FakeUserbot();
    userbot.pingOk = false;
    userbot.latenciaMs = null;

    const resultado = (await manejador(
      { chatId: 123 },
      crearContexto(userbot),
    )) as ResultadoWatchdogPing;

    expect(resultado.ok).toBe(false);
    expect(resultado.alerta).toBe(true);
    expect(resultado.motivo).toMatch(/no respondio/);
  });

  it("alerta cuando la latencia supera el umbral aunque el ping haya ido ok", async () => {
    const watchdog = new FakeWatchdogRepository();
    const manejadores = manejadoresDeOperacion({ watchdog });
    const manejador = unManejador(manejadores, "operacion.watchdog_ping");

    const userbot = new FakeUserbot();
    userbot.pingOk = true;
    userbot.latenciaMs = UMBRAL_LATENCIA_MS + 1;

    const resultado = (await manejador(
      { chatId: 123 },
      crearContexto(userbot),
    )) as ResultadoWatchdogPing;

    expect(resultado.ok).toBe(true);
    expect(resultado.alerta).toBe(true);
    expect(resultado.motivo).toMatch(/supera el umbral/);
  });

  it("no alerta por latencia si esta justo en el umbral, solo por encima", async () => {
    const watchdog = new FakeWatchdogRepository();
    const manejadores = manejadoresDeOperacion({ watchdog });
    const manejador = unManejador(manejadores, "operacion.watchdog_ping");

    const userbot = new FakeUserbot();
    userbot.pingOk = true;
    userbot.latenciaMs = UMBRAL_LATENCIA_MS;

    const resultado = (await manejador(
      { chatId: 123 },
      crearContexto(userbot),
    )) as ResultadoWatchdogPing;

    expect(resultado.alerta).toBe(false);
  });

  it("alerta por caida sostenida cuando esta es la tercera medicion seguida en fallo", async () => {
    const watchdog = new FakeWatchdogRepository();
    // Dos fallos previos ya en el historial.
    await watchdog.registrar({ latenciaMs: null, ok: false });
    await watchdog.registrar({ latenciaMs: null, ok: false });

    const manejadores = manejadoresDeOperacion({ watchdog });
    const manejador = unManejador(manejadores, "operacion.watchdog_ping");

    const userbot = new FakeUserbot();
    userbot.pingOk = false;
    userbot.latenciaMs = null;

    const resultado = (await manejador(
      { chatId: 123 },
      crearContexto(userbot),
    )) as ResultadoWatchdogPing;

    expect(resultado.alerta).toBe(true);
    expect(resultado.motivo).toMatch(/mediciones seguidas fallaron/);
  });

  it("no alerta por caida sostenida cuando el fallo actual es puntual", async () => {
    const watchdog = new FakeWatchdogRepository();
    // Historial sano hasta ahora.
    await watchdog.registrar({ latenciaMs: 40, ok: true });
    await watchdog.registrar({ latenciaMs: 40, ok: true });

    const manejadores = manejadoresDeOperacion({ watchdog });
    const manejador = unManejador(manejadores, "operacion.watchdog_ping");

    const userbot = new FakeUserbot();
    userbot.pingOk = false;
    userbot.latenciaMs = null;

    const resultado = (await manejador(
      { chatId: 123 },
      crearContexto(userbot),
    )) as ResultadoWatchdogPing;

    // Alerta igual, pero por el fallo inmediato, no por caida sostenida.
    expect(resultado.alerta).toBe(true);
    expect(resultado.motivo).toMatch(/no respondio/);
    expect(resultado.motivo).not.toMatch(/mediciones seguidas fallaron/);
  });

  it("acepta chatId como texto numerico ademas de como number", async () => {
    const watchdog = new FakeWatchdogRepository();
    const manejadores = manejadoresDeOperacion({ watchdog });
    const manejador = unManejador(manejadores, "operacion.watchdog_ping");

    const userbot = new FakeUserbot();
    userbot.pingOk = true;
    userbot.latenciaMs = 10;

    const resultado = (await manejador(
      { chatId: "123" },
      crearContexto(userbot),
    )) as ResultadoWatchdogPing;

    expect(resultado.ok).toBe(true);
  });

  it("lanza si falta chatId", async () => {
    const watchdog = new FakeWatchdogRepository();
    const manejadores = manejadoresDeOperacion({ watchdog });
    const manejador = unManejador(manejadores, "operacion.watchdog_ping");

    await expect(
      manejador({}, crearContexto(new FakeUserbot())),
    ).rejects.toThrow(/chatId/);
  });
});

describe("operacion.sonda_despliegue", () => {
  it("prueba cada comando con un ping y devuelve si el bot respondio", async () => {
    const watchdog = new FakeWatchdogRepository();
    const manejadores = manejadoresDeOperacion({ watchdog });
    const manejador = unManejador(manejadores, "operacion.sonda_despliegue");

    const userbot = new FakeUserbot();
    userbot.pingOk = true;

    const resultado = (await manejador(
      { chatId: 123, comandos: ["/start", "/help", "/mascota"] },
      crearContexto(userbot),
    )) as ResultadoSondaComando[];

    expect(resultado).toEqual([
      { comando: "/start", respondioOk: true },
      { comando: "/help", respondioOk: true },
      { comando: "/mascota", respondioOk: true },
    ]);
  });

  it("marca todos los comandos como caidos si el bot no responde", async () => {
    const watchdog = new FakeWatchdogRepository();
    const manejadores = manejadoresDeOperacion({ watchdog });
    const manejador = unManejador(manejadores, "operacion.sonda_despliegue");

    const userbot = new FakeUserbot();
    userbot.pingOk = false;

    const resultado = (await manejador(
      { chatId: 123, comandos: ["/start", "/help"] },
      crearContexto(userbot),
    )) as ResultadoSondaComando[];

    expect(resultado.every((r) => r.respondioOk === false)).toBe(true);
    expect(resultado.map((r) => r.comando)).toEqual(["/start", "/help"]);
  });

  it("lanza si falta la lista de comandos", async () => {
    const watchdog = new FakeWatchdogRepository();
    const manejadores = manejadoresDeOperacion({ watchdog });
    const manejador = unManejador(manejadores, "operacion.sonda_despliegue");

    await expect(
      manejador({ chatId: 123 }, crearContexto(new FakeUserbot())),
    ).rejects.toThrow(/comandos/);
  });

  it("lanza si la lista de comandos esta vacia", async () => {
    const watchdog = new FakeWatchdogRepository();
    const manejadores = manejadoresDeOperacion({ watchdog });
    const manejador = unManejador(manejadores, "operacion.sonda_despliegue");

    await expect(
      manejador(
        { chatId: 123, comandos: [] },
        crearContexto(new FakeUserbot()),
      ),
    ).rejects.toThrow(/comandos/);
  });

  it("lanza si algun elemento de la lista no es texto", async () => {
    const watchdog = new FakeWatchdogRepository();
    const manejadores = manejadoresDeOperacion({ watchdog });
    const manejador = unManejador(manejadores, "operacion.sonda_despliegue");

    await expect(
      manejador(
        { chatId: 123, comandos: ["/start", 42] },
        crearContexto(new FakeUserbot()),
      ),
    ).rejects.toThrow(/comandos/);
  });
});
