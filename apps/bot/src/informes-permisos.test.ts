import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Los 25 informes de staff piden ser admin, y ninguno pedia nada.
 *
 * `handleDataReportsCommand` son ~770 lineas con 25 `case` y **cero**
 * comprobaciones de permisos. El mismo dato ya estaba detras de la puerta
 * fuerte por el otro camino: `/apelacion list` pasa por
 * `ensureConfigPermission(..., "d1.appeals")` y el callback de resolverlas
 * exige `isActorAdmin`.
 *
 * Y no se quedaba en el grupo. `listAppeals` devuelve tambien las filas con
 * `chatId: null` —las apelaciones abiertas en privado— y hay un solo tenant por
 * bot, asi que cualquiera que abriera un DM con el bot y escribiera
 * `/apelaciones_por_incidente` recibia todas las apelaciones privadas del
 * despliegue entero, con referencia de caso y el id de Telegram de quien apelo.
 * Sin estar en ningun grupo.
 *
 * Se comprueba contra la FUENTE, igual que `utility-plus-permisos.test.ts`:
 * construir el servicio pide 56 dobles, y lo que hay que impedir es que alguien
 * anada un `case` nuevo por debajo de la guarda.
 */

const FUENTE = readFileSync(
  fileURLToPath(new URL("./bot-update.service.ts", import.meta.url)),
  "utf8",
);

/** El cuerpo de `handleDataReportsCommand`, de su firma al cierre. */
const cuerpoDelHandler = (): string => {
  const inicio = FUENTE.indexOf("  private async handleDataReportsCommand(");
  expect(inicio).toBeGreaterThan(0);
  const fin = FUENTE.indexOf("\n  }\n", inicio);
  expect(fin).toBeGreaterThan(inicio);
  return FUENTE.slice(inicio, fin);
};

/** Los nombres del conjunto declarado arriba del fichero. */
const conjuntoDeclarado = (): readonly string[] => {
  const inicio = FUENTE.indexOf(
    "const COMANDOS_DE_INFORME: ReadonlySet<string> = new Set([",
  );
  expect(inicio).toBeGreaterThan(0);
  const fin = FUENTE.indexOf("]);", inicio);
  expect(fin).toBeGreaterThan(inicio);
  return [...FUENTE.slice(inicio, fin).matchAll(/"([a-z_]+)"/gu)]
    .map((m) => m[1])
    .filter((n): n is string => n !== undefined);
};

describe("los informes de staff piden permisos", () => {
  it("la guarda de admin esta, y ANTES del switch", () => {
    // Si estuviera despues, cada `case` tendria que acordarse por su cuenta —
    // que es exactamente como se llego a cero guardas en 770 lineas.
    const cuerpo = cuerpoDelHandler();
    const guarda = cuerpo.indexOf("isActorAdmin");
    const conmutador = cuerpo.indexOf("switch (name)");

    expect(guarda).toBeGreaterThan(0);
    expect(conmutador).toBeGreaterThan(guarda);
  });

  it("todos los `case` estan en el conjunto que la guarda filtra", () => {
    // EL TEST QUE IMPORTA. La guarda solo protege lo que el conjunto nombra:
    // un informe nuevo que no entre ahi no responde —ruidoso, se ve enseguida—
    // pero si alguien ademas lo mete en el conjunto sin querer, queda cubierto.
    // Lo que no puede pasar es lo contrario: un `case` fuera del conjunto Y por
    // debajo de la guarda.
    const cuerpo = cuerpoDelHandler();
    const casos = [...cuerpo.matchAll(/^ {6}case "([a-z_]+)":/gmu)]
      .map((m) => m[1])
      .filter((n): n is string => n !== undefined);

    expect(casos.length).toBeGreaterThan(20);

    const declarados = new Set(conjuntoDeclarado());
    expect(casos.filter((c) => !declarados.has(c))).toEqual([]);
  });

  it("y el conjunto no nombra informes que ya no existen", () => {
    // Al reves tambien importa: un nombre de mas en el conjunto no protege
    // nada y hace creer que si.
    const cuerpo = cuerpoDelHandler();
    const casos = new Set(
      [...cuerpo.matchAll(/^ {6}case "([a-z_]+)":/gmu)].map((m) => m[1]),
    );

    expect(conjuntoDeclarado().filter((n) => !casos.has(n))).toEqual([]);
  });
});
