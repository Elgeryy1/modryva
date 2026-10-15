import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Ninguna clave de idempotencia puede ser aleatoria.
 *
 * `economyRepository.credit`, `chipRepository.debit` y compania son idempotentes
 * por `refId`: con el mismo (motivo, refId) el apunte ocurre UNA vez. Toda esa
 * proteccion depende de que la clave sea **la misma en cada intento**. Con un
 * `randomUUID()` el segundo intento trae otra clave, el indice unico del libro
 * mayor ve dos apuntes distintos y **paga las dos veces**.
 *
 * Habia diez sitios asi: la transferencia de fichas, el identificador de apuesta
 * del casino (que es a la vez clave del cobro, la devolucion y el premio), el
 * robo, la compra, el cobro y la devolucion de la fianza, y las tres
 * operaciones de la casa de cambio. Antes casi no se notaba, porque un update
 * que fallaba se perdia y no habia reintento; desde que el poller reintenta en
 * vez de perderlo, se nota.
 *
 * Este test recorre la fuente y falla si vuelve a aparecer una. No comprueba
 * una lista escrita a mano: mira las llamadas reales.
 */

const FUENTE = join(__dirname, "bot-update.service.ts");

/** Metodos cuyo ultimo argumento (o campo `refId`) es la clave de idempotencia. */
const METODOS_CON_CLAVE =
  /(economyRepository|chipRepository|exchangeRepository)\.\w+\(/;

/**
 * Bloques de argumentos de cada llamada a un repositorio con clave, mas
 * cualquier objeto que traiga un campo `refId` o `betId`.
 */
const llamadasConClave = (): readonly { linea: number; texto: string }[] => {
  const lineas = readFileSync(FUENTE, "utf8").split("\n");
  const salida: { linea: number; texto: string }[] = [];

  for (let i = 0; i < lineas.length; i += 1) {
    const linea = lineas[i];
    if (linea === undefined) continue;

    // Una llamada a repositorio con clave: se mira su bloque de argumentos.
    if (METODOS_CON_CLAVE.test(linea)) {
      const bloque = lineas.slice(i, i + 14).join("\n");
      const cierre = bloque.indexOf("\n    );");
      salida.push({
        linea: i + 1,
        texto: cierre > 0 ? bloque.slice(0, cierre) : bloque,
      });
      continue;
    }

    // Un campo de clave declarado suelto (refId:, betId:).
    if (/^\s+(refId|betId):/.test(linea)) {
      salida.push({ linea: i + 1, texto: linea });
    }
  }
  return salida;
};

describe("claves de idempotencia", () => {
  it("ninguna llamada que mueve saldo usa randomUUID como clave", () => {
    const aleatorias = llamadasConClave()
      .filter((llamada) => llamada.texto.includes("randomUUID()"))
      .map((llamada) => `bot-update.service.ts:${llamada.linea}`);

    // Si esto falla, has puesto una clave que cambia en cada intento: ese
    // efecto se duplicara en cuanto el update se reprocese. Deriva la clave del
    // update con `claveDeterminista(update, "<que-efecto>")`.
    expect(aleatorias).toEqual([]);
  });

  it("las claves se derivan del update, que es lo unico estable entre intentos", () => {
    const fuente = readFileSync(FUENTE, "utf8");
    // El helper existe y se usa. Si alguien lo borra creyendo que sobra, este
    // test lo para.
    expect(fuente).toContain("private claveDeterminista(");
    // La clave sale del updateId y del sufijo. Se comprueba por partes para no
    // meter un marcador de plantilla dentro de una cadena normal.
    const cuerpo = fuente.slice(
      fuente.indexOf("private claveDeterminista("),
      fuente.indexOf("private claveDeterminista(") + 240,
    );
    expect(cuerpo).toContain("update.updateId");
    expect(cuerpo).toContain("sufijo");
    const usos = fuente.match(/this\.claveDeterminista\(/g) ?? [];
    expect(usos.length).toBeGreaterThanOrEqual(10);
  });

  it("randomUUID sigue usandose donde SI debe ser aleatorio", () => {
    const fuente = readFileSync(FUENTE, "utf8");
    // Semillas, salts e identidades nuevas tienen que ser impredecibles. El
    // test de arriba no debe empujar a nadie a hacerlos deterministas "por
    // coherencia": son lo contrario de una clave de idempotencia.
    const restantes = fuente.match(/randomUUID\(\)/g) ?? [];
    expect(restantes.length).toBeGreaterThanOrEqual(4);
  });
});
