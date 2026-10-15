import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { expirationJobNames } from "./server.js";

/**
 * Un job no puede dejar de hacerse en silencio.
 *
 * El fallo que esto cierra: los repetibles de BullMQ viven en **Redis**, no en
 * el codigo. Si alguien renombra un job o lo saca de `expirationJobNames`, el
 * viejo sigue programado y disparando cada minuto — y el worker lo resolvia con
 * un `{ ok: true }` generico, asi que BullMQ lo marcaba completado. Resultado:
 * las sanciones podian dejar de expirar para siempre sin que nadie se enterara.
 *
 * Ahora un nombre desconocido **lanza**, que es lo unico que BullMQ entiende
 * como fallo, y los repetibles obsoletos se retiran al arrancar.
 */

const FUENTE = join(__dirname, "server.ts");

describe("jobs declarados y jobs implementados", () => {
  it("todo nombre declarado tiene su case en el despachador", () => {
    const fuente = readFileSync(FUENTE, "utf8");
    const inicio = fuente.indexOf("export const runExpirationJob");
    const cuerpo = fuente.slice(inicio, fuente.indexOf("\n};", inicio));

    const sinImplementar = expirationJobNames.filter(
      (nombre) => !cuerpo.includes(`case "${nombre}":`),
    );

    // Si esto falla, has declarado un job que nadie ejecuta. Antes se
    // completaba solo; ahora lanzaria en produccion cada minuto.
    expect(sinImplementar).toEqual([]);
  });

  it("no hay cases para nombres que ya no se declaran", () => {
    const fuente = readFileSync(FUENTE, "utf8");
    const inicio = fuente.indexOf("export const runExpirationJob");
    const cuerpo = fuente.slice(inicio, fuente.indexOf("\n};", inicio));

    const declarados = new Set<string>(expirationJobNames);
    const enElSwitch = [...cuerpo.matchAll(/case "([a-z0-9_.]+)":/g)].map(
      (m) => m[1] ?? "",
    );

    const huerfanos = enElSwitch.filter((nombre) => !declarados.has(nombre));
    // Un case sin declaracion nunca se ejecuta: o falta el nombre en la lista,
    // o sobra el case. Las dos cosas son un error que conviene ver.
    expect(huerfanos).toEqual([]);
  });

  it("el despachador lanza ante un nombre desconocido, no devuelve ok:false", () => {
    const fuente = readFileSync(FUENTE, "utf8");
    const inicio = fuente.indexOf("export const runExpirationJob");
    const cuerpo = fuente.slice(inicio, fuente.indexOf("\n};", inicio));

    // Devolver `{ ok: false }` no sirve: BullMQ solo marca fallo cuando se
    // lanza, asi que el job se completaba igual.
    expect(cuerpo).not.toContain("return { ok: false }");
    expect(cuerpo).toContain("throw new Error");
  });

  it("el worker lanza ante un job no declarado, en vez de darlo por hecho", () => {
    const fuente = readFileSync(FUENTE, "utf8");
    const inicio = fuente.indexOf("const worker = new Worker(");
    const cuerpo = fuente.slice(inicio, inicio + 2000);

    expect(cuerpo).toContain("job desconocido");
    expect(cuerpo).not.toContain("return { ok: true, processedAt");
  });

  it("los repetibles obsoletos se retiran al arrancar", () => {
    const fuente = readFileSync(FUENTE, "utf8");
    expect(fuente).toContain("getRepeatableJobs");
    expect(fuente).toContain("removeRepeatableByKey");
  });

  it("no hay nombres duplicados en la lista", () => {
    expect(expirationJobNames.length).toBe(new Set(expirationJobNames).size);
  });
});
