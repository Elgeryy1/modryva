/**
 * El saldo de la economia se mueve por UNA puerta.
 *
 * `cobrarSaldoDeCartera` y `abonarSaldoDeCartera`, en `economy-repository.ts`,
 * son las dos unicas funciones que suman o restan `balance` en
 * `economy_wallets`. Ahi vive la bandera `unlimited`: una cartera con saldo
 * sin fondo paga sin moverse y no recibe abonos. Un `increment` o un
 * `decrement` escrito a mano en otro fichero se la salta sin que falle nada.
 *
 * No es teorico. El 2026-09-09 la bandera se repartio por esas dos funciones y
 * `pet-repository.ts` siguio con sus cuatro caminos propios. El 2026-09-11, con
 * carteras en el techo del `integer`, el rendimiento de las mascotas reventaba
 * con "integer out of range" una vez por minuto —la transaccion se deshacia,
 * `vistaEn` no avanzaba y el barrido la volvia a coger— y las raciones restaban
 * de carteras que se suponian congeladas. Se habia buscado con grep, y el grep
 * se corto antes de llegar a ese fichero. Por eso ahora lo mira un test.
 *
 * Lo que sigue permitido fuera de la puerta: FIJAR un saldo exacto (`balance:
 * resto` al operar, que ademas se salta las carteras sin fondo) y crear la fila
 * con su saldo inicial. Lo que se prohibe es sumar y restar.
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DIRECTORIO = fileURLToPath(new URL(".", import.meta.url));
const LA_PUERTA = "economy-repository.ts";

/** El texto de la llamada que empieza en `inicio`, hasta su `)` de cierre. */
const llamadaDesde = (fuente: string, inicio: number): string => {
  const abre = fuente.indexOf("(", inicio);
  let nivel = 0;
  for (let i = abre; i < fuente.length; i++) {
    if (fuente[i] === "(") {
      nivel++;
    } else if (fuente[i] === ")") {
      nivel--;
      if (nivel === 0) {
        return fuente.slice(inicio, i + 1);
      }
    }
  }
  return fuente.slice(inicio);
};

/** Las escrituras sobre `economyWallet` que suman o restan `balance`. */
const escriturasDeSaldo = (fuente: string): string[] => {
  const encontradas: string[] = [];
  for (const casa of fuente.matchAll(
    /economyWallet\.(?:update|updateMany|upsert)\(/gu,
  )) {
    const llamada = llamadaDesde(fuente, casa.index ?? 0);
    if (/balance:\s*\{\s*(?:increment|decrement)/u.test(llamada)) {
      encontradas.push(llamada.split("\n")[0] ?? llamada);
    }
  }
  return encontradas;
};

describe("el saldo se mueve por una sola puerta", () => {
  const ficheros = readdirSync(DIRECTORIO).filter(
    (nombre) => nombre.endsWith(".ts") && !nombre.endsWith(".test.ts"),
  );

  it("encuentra los ficheros que tiene que vigilar", () => {
    // Sin esto, un cambio de ruta dejaria el test en verde mirando cero
    // ficheros, que es la forma mas silenciosa de perder un control.
    expect(ficheros).toContain(LA_PUERTA);
    expect(ficheros).toContain("pet-repository.ts");
    expect(ficheros).toContain("exchange-repository.ts");
  });

  it("nadie fuera de la puerta suma ni resta balance a mano", () => {
    const infractores = ficheros
      .filter((nombre) => nombre !== LA_PUERTA)
      .flatMap((nombre) =>
        escriturasDeSaldo(readFileSync(`${DIRECTORIO}${nombre}`, "utf8")).map(
          (linea) => `${nombre}: ${linea.trim()}`,
        ),
      );
    expect(infractores).toEqual([]);
  });

  it("y el detector caza lo que tiene que cazar", () => {
    // El caso del incidente, tal y como estaba escrito en pet-repository.
    const incidente = `await tx.economyWallet.update({
      where: { tenantId_chatId_userTelegramId: { tenantId, chatId, userTelegramId } },
      data: { balance: { increment: monedas } },
    });`;
    expect(escriturasDeSaldo(incidente)).toHaveLength(1);

    // Y lo que sigue permitido: fijar un saldo exacto no es sumar ni restar.
    const fijar = `await tx.economyWallet.updateMany({
      where: { tenantId, balance: cartera.balance },
      data: { balance: resto },
    });`;
    expect(escriturasDeSaldo(fijar)).toHaveLength(0);
  });
});
