import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Un manifiesto de modulo no puede prometer un comando que no existe.
 *
 * No es decorativo: `apps/api/src/bootstrap.controller.ts` y
 * `health.controller.ts` **sirven los manifiestos a los clientes**. Lo que
 * declaren ahi es lo que la Mini App cree que el bot sabe hacer.
 *
 * Hoy hay uno inventado, `/policy_test`, y esta abajo con nombre y motivo.
 */

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * Comandos declarados que **no existen en el codigo**, con su motivo.
 *
 * Esta lista **solo puede menguar**. Anadir una entrada rompe el test igual que
 * quitarla sin arreglar la causa, para que la decision se tome a proposito y no
 * se acumule sola.
 *
 * - `security/policy_test` — el manifiesto lo declara y
 *   `informe_superbot_telegram_todo_en_uno_portable.md` lo documenta como
 *   funcion real ("Explica que regla actuaria"), pero **no hay handler en
 *   ningun sitio**. Que se resuelva quitandolo del manifiesto o
 *   implementandolo es una decision de producto del propietario, no de una
 *   refactorizacion: borrarlo se lleva por delante una funcion prometida, e
 *   inventarlo es codigo nuevo que nadie pidio.
 */
const FICCION_CONOCIDA: readonly string[] = ["security/policy_test"];

const ficherosDe = (dir: string, salida: string[] = []): string[] => {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) {
      if (entrada === "node_modules" || entrada === "dist") continue;
      ficherosDe(ruta, salida);
    } else if (
      /\.tsx?$/u.test(entrada) &&
      !/\.test\.tsx?$/u.test(entrada) &&
      !/manifest\.ts$/u.test(entrada)
    ) {
      salida.push(ruta);
    }
  }
  return salida;
};

/** Todo el codigo que puede reconocer un comando, sin tests ni manifiestos. */
const FUENTES = [
  ...ficherosDe(join(RAIZ, "apps/bot/src")),
  ...ficherosDe(join(RAIZ, "modules")),
].map((f) => readFileSync(f, "utf8"));

/** Lo que declara cada manifiesto, leido del fichero. */
const declarados = (): readonly { modulo: string; comando: string }[] => {
  const salida: { modulo: string; comando: string }[] = [];
  for (const modulo of readdirSync(join(RAIZ, "modules"))) {
    const ruta = join(RAIZ, "modules", modulo, "src", "manifest.ts");
    let fuente: string;
    try {
      fuente = readFileSync(ruta, "utf8");
    } catch {
      continue;
    }
    const bloque = /commands:\s*\[([\s\S]*?)\]/u.exec(fuente);
    if (!bloque?.[1]) continue;
    for (const encontrado of bloque[1].matchAll(/name:\s*"([^"]+)"/gu)) {
      const comando = encontrado[1];
      if (comando !== undefined) salida.push({ modulo, comando });
    }
  }
  return salida;
};

describe("los manifiestos no prometen comandos que no existen", () => {
  it("cada comando declarado aparece en el codigo, salvo la ficcion conocida", () => {
    const inventados = declarados()
      .filter(({ comando }) => !FUENTES.some((t) => t.includes(`"${comando}"`)))
      .map(({ modulo, comando }) => `${modulo}/${comando}`);

    expect(inventados.sort()).toEqual([...FICCION_CONOCIDA].sort());
  });

  it("y hay manifiestos declarando comandos de verdad", () => {
    // Si alguien vaciara los manifiestos, el test de arriba pasaria en vacio.
    expect(declarados().length).toBeGreaterThan(10);
  });
});
