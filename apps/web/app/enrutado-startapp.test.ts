import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Todo tipo de enlace que la Mini App sabe LEER tiene que tener destino.
 *
 * El chivato de `config-meta.test.ts` comprueba que shared y la web decodifican
 * igual. Este comprueba lo siguiente, que es donde se rompio dos veces: que
 * `app/page.tsx` haga algo con lo que ha decodificado.
 *
 * Las dos veces el sintoma fue el mismo y es el peor posible — **el enlace
 * abre la app y se queda en la pantalla de inicio**, sin error ni pista:
 *
 * - `shop_` decodificaba bien y la raiz no tenia rama. El boton "Abrir la
 *   tienda" del anuncio no iba a ninguna parte.
 * - `pet_` lo mismo, y se descubrio comprobando el enlace ANTES de anunciar
 *   las mascotas a 230 personas.
 *
 * Un tipo nuevo sin su rama rompe este test, que es justo cuando sale barato.
 */

const raiz = dirname(fileURLToPath(import.meta.url));

/**
 * Los que NO llevan a una pantalla propia, con su motivo.
 *
 * La lista **solo puede menguar**: añadir uno rompe el test igual que quitarlo
 * sin poner la rama, para que la decision se tome a proposito.
 */
const SIN_PANTALLA_PROPIA: Record<string, string> = {
  // Se resuelven dentro de la pantalla de juegos, no en la raiz.
  game: "lo enruta el hub de juegos con el nombre del juego",
  inlineGame: "se abre en linea desde el chat, sin pasar por la raiz",
};

describe("chivato: todo enlace decodificable llega a alguna pantalla", () => {
  it("cada kind de startapp tiene rama en la raiz de la Mini App", () => {
    const codec = readFileSync(join(raiz, "../lib/config-meta.ts"), "utf8");
    const raizTsx = readFileSync(join(raiz, "page.tsx"), "utf8");

    const kinds = [
      ...new Set(
        [...codec.matchAll(/kind:\s*"([A-Za-z]+)"/gu)].map((m) => m[1]),
      ),
    ].filter((kind): kind is string => Boolean(kind));

    expect(kinds.length).toBeGreaterThan(4);

    const sinRama = kinds.filter(
      (kind) =>
        !SIN_PANTALLA_PROPIA[kind] &&
        !raizTsx.includes(`kind === "${kind}"`) &&
        !raizTsx.includes(`case "${kind}"`),
    );

    expect(sinRama).toEqual([]);
  });
});
