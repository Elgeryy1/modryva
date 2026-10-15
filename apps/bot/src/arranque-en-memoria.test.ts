import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { BotUpdateService } from "./bot-update.service.js";

/**
 * La guarda que se niega a arrancar con repositorios en RAM.
 *
 * Es un camino que **solo se ejecuta en produccion**, o sea el que nadie prueba
 * nunca a mano. Y lo que protege es silencioso: si falta un proveedor en
 * `app.module.ts`, Nest inyecta `undefined`, entra el valor por defecto
 * `new InMemory...Repository()` y el bot arranca aparentemente sano guardando
 * saldos y verificaciones en memoria.
 *
 * Se invoca el metodo real con un `this` de mentira: `onModuleInit` solo lee
 * `Object.entries(this)`, asi que esto prueba la implementacion de verdad y no
 * una copia.
 */

const invocarGuarda = (campos: Record<string, unknown>): void => {
  BotUpdateService.prototype.onModuleInit.call(
    campos as unknown as BotUpdateService,
  );
};

class InMemoryEconomyRepository {}
class PrismaEconomyRepository {}

const NODE_ENV_ORIGINAL = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = NODE_ENV_ORIGINAL;
});

describe("negarse a arrancar con repositorios en memoria", () => {
  it("en produccion lanza y NOMBRA el que se cayo a memoria", () => {
    // Nombrarlo es la mitad del valor: sin el nombre, quien lo vea a las tres
    // de la manana no sabe que proveedor falta.
    process.env.NODE_ENV = "production";

    expect(() =>
      invocarGuarda({ economyRepository: new InMemoryEconomyRepository() }),
    ).toThrow(/economyRepository/u);
  });

  it("en produccion los cuenta a todos, no solo el primero", () => {
    process.env.NODE_ENV = "production";

    expect(() =>
      invocarGuarda({
        economyRepository: new InMemoryEconomyRepository(),
        guardianRepository: new InMemoryEconomyRepository(),
      }),
    ).toThrow(/2 repositorio/u);
  });

  it("en produccion con repositorios de verdad NO estorba", () => {
    process.env.NODE_ENV = "production";

    expect(() =>
      invocarGuarda({ economyRepository: new PrismaEconomyRepository() }),
    ).not.toThrow();
  });

  it("fuera de produccion no comprueba nada", () => {
    // En test y desarrollo los repositorios en memoria son justo lo que se
    // quiere; si aqui saltara, no se podria ejecutar ni un test.
    process.env.NODE_ENV = "test";

    expect(() =>
      invocarGuarda({ economyRepository: new InMemoryEconomyRepository() }),
    ).not.toThrow();
  });
});

/**
 * Las lineas del constructor, que es donde viven los fallbacks.
 *
 * Se acota a proposito: fuera del constructor la clase tiene tres campos en
 * memoria **queridos** —`reactionSurgeStore`, `reactionAlertGate` y
 * `reactionPermissionCache`, caches acotadas por TTL de la moderacion de
 * reacciones—. Esos no son un fallback de nada y la guarda no debe mirarlos.
 */
const lineasDelConstructor = (): readonly string[] => {
  const fuente = readFileSync(
    fileURLToPath(new URL("./bot-update.service.ts", import.meta.url)),
    "utf8",
  );
  const lineas = fuente.split("\n");

  const inicio = lineas.findIndex((l) =>
    l.trimStart().startsWith("constructor("),
  );
  expect(inicio).toBeGreaterThan(0);

  const fin = lineas.findIndex(
    (l, i) => i > inicio && /^\s*\)\s*\{\}?\s*$/u.test(l),
  );
  expect(fin).toBeGreaterThan(inicio);

  return lineas.slice(inicio, fin + 1);
};

describe("la guarda no puede quedarse ciega", () => {
  it("todo fallback InMemory vive en un campo que el filtro ve", () => {
    // EL TEST QUE IMPORTA. La guarda filtra por
    // `clave.toLowerCase().includes("repository")`. Un campo nuevo con
    // fallback en memoria y otro nombre —`messageStore`, `guardianCache`—
    // pasaria por delante de ella sin que fallara nada, que es exactamente el
    // fallo que la guarda existe para evitar.
    const lineas = lineasDelConstructor();

    const invisibles: string[] = [];
    for (let i = 0; i < lineas.length; i += 1) {
      const linea = lineas[i];
      if (linea === undefined || !linea.includes("= new InMemory")) continue;

      // El nombre del campo esta en esta linea o en alguna de las tres
      // anteriores: el formateador parte las firmas largas.
      let nombre: string | undefined;
      for (let j = i; j >= Math.max(0, i - 3); j -= 1) {
        const candidata = lineas[j];
        if (candidata === undefined) continue;
        const encontrado = /readonly\s+([a-zA-Z0-9_]+)\s*:/u.exec(candidata);
        if (encontrado?.[1] !== undefined) {
          nombre = encontrado[1];
          break;
        }
      }

      if (nombre === undefined) {
        invisibles.push(`(sin nombre) linea ${i + 1}`);
      } else if (!nombre.toLowerCase().includes("repository")) {
        invisibles.push(nombre);
      }
    }

    expect(invisibles).toEqual([]);
  });

  it("y hay fallbacks de verdad que comprobar", () => {
    // Si alguien los quitara todos, el test de arriba pasaria en vacio y
    // dejaria de decir nada.
    const cuantos =
      lineasDelConstructor().join("\n").split("= new InMemory").length - 1;

    expect(cuantos).toBeGreaterThan(15);
  });
});
