import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Mantiene cerrada la puerta de permisos de `handleUtilityPlusCommand`.
 *
 * Ese metodo son 2.095 lineas con 124 `case` y hasta el 2026-08-19 **no tenia
 * ni una sola comprobacion de permisos**. Ocho de esos casos escriben: seis
 * tocan ajustes de moderacion del chat, uno cierra un tema del foro, y
 * `/modo_solo_lectura` llama a `setChatPermissions` dejando el grupo entero
 * mudo. Todos estan publicados en el menu `/` de Telegram, asi que cualquier
 * miembro los veia y los podia ejecutar; y como `utility-plus.command` no esta
 * en `GATED_HANDLERS`, el modo pasivo tampoco los frenaba.
 *
 * El arreglo es una lista declarativa, `COMANDOS_UTILITY_PLUS_CON_EFECTO`, que
 * exige admin. Una lista escrita a mano se queda desfasada en cuanto alguien
 * anade un comando, asi que este test no la comprueba contra otra lista: la
 * comprueba **contra la fuente**. Si aparece un `case` nuevo que escribe y no
 * esta declarado, el test falla y dice cual.
 */

const FUENTE = join(__dirname, "bot-update.service.ts");

/**
 * Llamadas que cambian estado.
 *
 * Las dos primeras formas son directas: el gateway de Telegram, o una escritura
 * en un repositorio. La tercera es indirecta y hace falta desde que los casos
 * empiezan a salir a modulos: al extraer uno, la escritura deja de estar dentro
 * del `case` y pasa a hacerla el modulo a traves de un puerto. En el case solo
 * queda `this.puertoDeX(context)`.
 *
 * Sin esa tercera forma este guardia **se iria quedando ciego segun avanza la
 * modularizacion**: cada caso extraido dejaria de contar como que escribe, y
 * alguien podria sacarlo de la lista de admin creyendo que ya no hace nada.
 *
 * De ahi el prefijo `puertoDe` en las fabricas del nucleo. Es una convencion, y
 * su unica razon de ser es hacer visible aqui lo que el modulo hara alli.
 */
const ESCRITURA =
  /telegramGateway\.|Repository\.(set|save|create|update|delete|upsert|add|remove|write|record|grant|revoke)|this\.puertoDe[A-Z]/;

/** Los `case` de handleUtilityPlusCommand que contienen alguna escritura. */
const casosConEfecto = (): readonly string[] => {
  const lineas = readFileSync(FUENTE, "utf8").split("\n");
  const inicio = lineas.findIndex((l) =>
    l.includes("private async handleUtilityPlusCommand("),
  );
  if (inicio < 0) throw new Error("no encuentro handleUtilityPlusCommand");

  let fin = lineas.length;
  for (let i = inicio + 1; i < lineas.length; i += 1) {
    if (lineas[i] === "  }") {
      fin = i;
      break;
    }
  }

  const conEfecto = new Set<string>();
  let casoActual: string | undefined;
  for (let i = inicio; i < fin; i += 1) {
    const linea = lineas[i];
    if (linea === undefined) break;
    const encaje = linea.match(/^\s+case "([a-z_0-9]+)":/);
    const nombre = encaje?.[1];
    if (nombre !== undefined) {
      casoActual = nombre;
      continue;
    }
    if (casoActual !== undefined && ESCRITURA.test(linea)) {
      conEfecto.add(casoActual);
    }
  }
  return [...conEfecto].sort();
};

/** Los comandos declarados en COMANDOS_UTILITY_PLUS_CON_EFECTO. */
const casosDeclarados = (): readonly string[] => {
  const lineas = readFileSync(FUENTE, "utf8").split("\n");
  const inicio = lineas.findIndex((l) =>
    l.startsWith("const COMANDOS_UTILITY_PLUS_CON_EFECTO"),
  );
  if (inicio < 0)
    throw new Error("no encuentro COMANDOS_UTILITY_PLUS_CON_EFECTO");

  const declarados: string[] = [];
  for (let i = inicio; i < lineas.length; i += 1) {
    const linea = lineas[i];
    if (linea === undefined) break;
    if (i > inicio && linea.startsWith("]);")) break;
    const encaje = linea.match(/^\s+"([a-z_0-9]+)",/);
    const nombre = encaje?.[1];
    if (nombre !== undefined) declarados.push(nombre);
  }
  return declarados.sort();
};

describe("handleUtilityPlusCommand: permisos", () => {
  it("todo comando que escribe esta declarado como que exige admin", () => {
    const sinDeclarar = casosConEfecto().filter(
      (caso) => !casosDeclarados().includes(caso),
    );
    // Si esto falla, has anadido un comando que cambia algo sin meterlo en
    // COMANDOS_UTILITY_PLUS_CON_EFECTO: cualquier miembro del grupo puede
    // ejecutarlo.
    expect(sinDeclarar).toEqual([]);
  });

  it("no declara comandos que ya no escriben nada", () => {
    // Al reves tambien importa: un comando declarado que ya no escribe deja de
    // ser un riesgo y exigirle admin pasa a ser una restriccion sin motivo.
    const sobrantes = casosDeclarados().filter(
      (caso) => !casosConEfecto().includes(caso),
    );
    expect(sobrantes).toEqual([]);
  });

  it("la puerta se comprueba antes del switch, no dentro de cada caso", () => {
    const fuente = readFileSync(FUENTE, "utf8");
    const puerta = fuente.indexOf("COMANDOS_UTILITY_PLUS_CON_EFECTO.has(name)");
    const metodo = fuente.indexOf("private async handleUtilityPlusCommand(");
    const primerCaso = fuente.indexOf('case "rango_accion":', metodo);
    expect(puerta).toBeGreaterThan(metodo);
    expect(puerta).toBeLessThan(primerCaso);
  });

  it("rechaza con el mismo texto que el resto del servicio", () => {
    const fuente = readFileSync(FUENTE, "utf8");
    const puerta = fuente.indexOf("COMANDOS_UTILITY_PLUS_CON_EFECTO.has(name)");
    const trozo = fuente.slice(puerta, puerta + 400);
    expect(trozo).toContain("No tienes permisos para moderar.");
    expect(trozo).toContain("isActorAdmin");
  });
});
