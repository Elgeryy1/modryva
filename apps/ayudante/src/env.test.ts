import { beforeEach, describe, expect, it } from "vitest";
import { _resetEnvCacheParaTests, obtenerEnv } from "./env.js";

const base = {
  AYUDANTE_API_ID: "12345",
  AYUDANTE_API_HASH: "hash",
  DATABASE_URL: "postgresql://x",
} as NodeJS.ProcessEnv;

const conEntorno = (extra: Record<string, string>) =>
  obtenerEnv({ ...base, ...extra } as NodeJS.ProcessEnv);

describe("obtenerEnv", () => {
  beforeEach(() => {
    _resetEnvCacheParaTests();
  });

  it("acepta la sesion como cadena", () => {
    expect(
      conEntorno({ AYUDANTE_SESSION: "1BQAsesion" }).AYUDANTE_SESSION,
    ).toBe("1BQAsesion");
  });

  it("acepta la sesion como fichero", () => {
    expect(
      conEntorno({ AYUDANTE_SESSION_PATH: "/data/sesion.txt" })
        .AYUDANTE_SESSION_PATH,
    ).toBe("/data/sesion.txt");
  });

  it("una alternativa VACIA no invalida la otra", () => {
    // `docker-compose` escribe `VAR: ${VAR:-}` cuando no hay valor, y eso
    // llega como cadena vacia, no como ausente. Con un `.min(1)` pelado, esto
    // tumbaba el contenedor aunque la sesion SI estuviera puesta. Paso en el
    // primer despliegue del 2026-09-03.
    expect(() =>
      conEntorno({ AYUDANTE_SESSION: "1BQAsesion", AYUDANTE_SESSION_PATH: "" }),
    ).not.toThrow();
    _resetEnvCacheParaTests();
    expect(() =>
      conEntorno({ AYUDANTE_SESSION: "", AYUDANTE_SESSION_PATH: "/s.txt" }),
    ).not.toThrow();
  });

  it("sin ninguna de las dos, falla y dice como generarla", () => {
    expect(() => conEntorno({})).toThrow(/login\.ts/);
  });

  it("las dos vacias cuentan como ninguna", () => {
    expect(() =>
      conEntorno({ AYUDANTE_SESSION: "", AYUDANTE_SESSION_PATH: "" }),
    ).toThrow(/AYUDANTE_SESSION/);
  });

  it("exige las credenciales de la app", () => {
    _resetEnvCacheParaTests();
    expect(() =>
      obtenerEnv({
        DATABASE_URL: "postgresql://x",
        AYUDANTE_SESSION: "s",
      } as NodeJS.ProcessEnv),
    ).toThrow(/AYUDANTE_API_ID/);
  });

  it("trae los valores por defecto del ritmo de la cola", () => {
    const env = conEntorno({ AYUDANTE_SESSION: "s" });
    expect(env.AYUDANTE_POLL_MS).toBe(5000);
    expect(env.AYUDANTE_LOTE).toBe(5);
  });
});
