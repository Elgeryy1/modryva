import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Un argumento que no es un numero no puede tumbar el update.
 *
 * `BigInt("pepe")` lanza, y los comandos de informe no son tolerantes: el error
 * se propaga, el update no se confirma y Telegram lo reentrega **tres veces**,
 * re-ejecutando todo el pipeline anterior. Acaba como `descartado`, que segun
 * `CLAUDE.md` significa "hay algo roto de verdad" — o sea que ademas ensucia la
 * metrica que existe para avisar de fallos reales.
 *
 * Lo dispara **cualquier miembro sin permisos** escribiendo
 * `/historial_cliente pepe`.
 *
 * Se comprueba contra la fuente porque el ayudante es privado del modulo y
 * construir el servicio pide 56 dobles. Lo que hay que impedir es que vuelva a
 * aparecer un `BigInt(` sobre un argumento sin filtrar.
 */

const FUENTE = readFileSync(
  fileURLToPath(new URL("./bot-update.service.ts", import.meta.url)),
  "utf8",
);

describe("ningun argumento crudo llega a BigInt", () => {
  it("no queda ningun BigInt(args[...]) suelto", () => {
    const sueltos = [
      ...FUENTE.matchAll(/BigInt\(\s*args\[[^\]]*\]\s*\)/gu),
    ].map((m) => m[0]);

    expect(sueltos).toEqual([]);
  });

  it("el ayudante existe y filtra por digitos", () => {
    // Sin el filtro, el ayudante no serviria de nada.
    expect(FUENTE).toContain("const idDeTelegramDelArgumento");
    const inicio = FUENTE.indexOf("const idDeTelegramDelArgumento");
    const trozo = FUENTE.slice(inicio, inicio + 200);

    expect(trozo).toMatch(/\d/u);
    expect(trozo).toContain("undefined");
  });

  it("se usa en TODOS los sitios que reciben un id por argumento", () => {
    const usos = [...FUENTE.matchAll(/idDeTelegramDelArgumento\(/gu)].length;

    // La declaracion es ` = (crudo`, asi que no casa: estos son los usos reales.
    //
    // El numero sube cuando aparece un comando que recibe un id de Telegram por
    // argumento, y eso es exactamente lo que tiene que obligar a pasar por
    // aqui. Hoy son cinco: `/historial_cliente`, `/darfichas`,
    // `/ajustarsaldo`, `/setmonedas` e `/ilimitado`.
    //
    // Bajarlo sin quitar un comando significa que alguien ha vuelto a parsear
    // un id a mano, que es el fallo que este fichero existe para impedir.
    expect(usos).toBe(5);
  });
});
