import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Ningun repositorio puede resolverse a memoria en produccion.
 *
 * 21 de los 56 parametros del constructor de `BotUpdateService` llevan un valor
 * por defecto `new InMemory...Repository()`. Estan para que un test pueda
 * construir el servicio sin montar 56 dobles, pero en produccion son una
 * trampa: si falta un proveedor en `app.module.ts` —renombrado, movido o
 * borrado— **Nest no falla**. Inyecta `undefined`, entra el valor por defecto, y
 * el bot arranca aparentemente sano guardando en RAM.
 *
 * Con `ECONOMY_REPOSITORY` eso son saldos que desaparecen al reiniciar. Con
 * `GUARDIAN_REPOSITORY`, verificaciones. Con `MESSAGE_LOG_REPOSITORY`, el
 * archivo entero. Y sin un solo error en el log.
 *
 * Este test es la primera barrera —se ve en CI, antes de desplegar—; el
 * `onModuleInit` del servicio es la segunda, y falla al arrancar.
 */

const SERVICIO = join(__dirname, "bot-update.service.ts");
const MODULO = join(__dirname, "app.module.ts");

/** Los tokens del constructor que caerian a un repositorio en memoria. */
const tokensConFallback = (): readonly string[] => {
  const lineas = readFileSync(SERVICIO, "utf8").split("\n");
  const inicio = lineas.findIndex((l) => l.startsWith("  constructor("));
  if (inicio < 0) throw new Error("no encuentro el constructor");

  const tokens: string[] = [];
  let tokenActual = "";
  for (let i = inicio; i < lineas.length; i += 1) {
    const linea = lineas[i];
    if (linea === undefined || linea.startsWith("  ) {")) break;

    const token = linea.match(/@Inject\(([A-Z_0-9]+)\)/);
    if (token?.[1]) tokenActual = token[1];

    if (/private readonly \w+:\s*\w+\s*=\s*new InMemory/.test(linea)) {
      if (tokenActual) tokens.push(tokenActual);
    }
  }
  return tokens;
};

describe("resolucion de dependencias del bot", () => {
  it("hay fallbacks a memoria, y son los que hay que vigilar", () => {
    // Si este numero baja, alguien los ha ido quitando y es una buena noticia:
    // actualiza el numero. Si sube, se ha anadido un fallback nuevo y hay que
    // comprobar que su proveedor existe.
    expect(tokensConFallback().length).toBe(21);
  });

  it("cada token con fallback tiene proveedor real en app.module.ts", () => {
    const modulo = readFileSync(MODULO, "utf8");
    const huerfanos = tokensConFallback().filter(
      (token) => !modulo.includes(`provide: ${token}`),
    );

    // Un token que falte aqui NO rompe el arranque: entra el repositorio en
    // memoria y produccion guarda en RAM en silencio. Por eso se comprueba.
    expect(huerfanos).toEqual([]);
  });

  it("ningun proveedor usa una implementacion en memoria", () => {
    const modulo = readFileSync(MODULO, "utf8");
    const enMemoria = [
      ...modulo.matchAll(
        /provide:\s*([A-Z_0-9]+)[\s\S]{0,160}?new (InMemory\w+)/g,
      ),
    ]
      .map((m) => `${m[1]} -> ${m[2]}`)
      // El contador de flood es deliberadamente en memoria: es una ventana
      // deslizante de segundos, no un dato que deba sobrevivir a un reinicio.
      .filter((linea) => !linea.startsWith("FLOOD_COUNTER "));

    expect(enMemoria).toEqual([]);
  });

  it("el servicio se niega a arrancar en produccion con repositorios en RAM", () => {
    const fuente = readFileSync(SERVICIO, "utf8");
    expect(fuente).toContain("onModuleInit");
    expect(fuente).toContain("resueltos a memoria en produccion");
    // Solo en produccion: en test y desarrollo los repositorios en memoria son
    // justo lo que se quiere.
    expect(fuente).toContain('process.env.NODE_ENV !== "production"');
  });
});
