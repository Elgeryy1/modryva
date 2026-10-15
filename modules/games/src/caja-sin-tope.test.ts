import { describe, expect, it } from "vitest";

import { defaultShopSettings, topeDeCajaFuerte, vaultLimitOf } from "./shop.js";

/**
 * La caja fuerte sin tope de quien esta en `ECONOMIA_CAJA_ILIMITADA_IDS`.
 *
 * Lo que hace y lo que NO hace importa por igual: levanta el limite de lo que
 * cabe DENTRO de la caja, y nada mas. No crea monedas, no cambia el saldo y no
 * toca nada para el resto. El efecto es que a esas personas no se les puede
 * robar lo que guarden.
 */

const TIENDA = defaultShopSettings;

describe("topeDeCajaFuerte", () => {
  it("sin la excepcion, es el tope de siempre", () => {
    // El control: si esto cambiara, la excepcion estaria afectando a todos.
    expect(topeDeCajaFuerte(TIENDA, 0, false)).toBe(vaultLimitOf(TIENDA, 0));
    expect(topeDeCajaFuerte(TIENDA, 5000, false)).toBe(
      vaultLimitOf(TIENDA, 5000),
    );
  });

  it("con la excepcion, no hay tope que valga", () => {
    expect(topeDeCajaFuerte(TIENDA, 0, true)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("y lo comprado con /comprar caja deja de importar", () => {
    // Quien tiene la excepcion no gana nada por comprar mas caja: ya cabe todo.
    expect(topeDeCajaFuerte(TIENDA, 0, true)).toBe(
      topeDeCajaFuerte(TIENDA, 999_999, true),
    );
  });

  it("es un numero utilizable, no Infinity", () => {
    // El valor viaja a la consulta como limite; un Infinity ahi no significa
    // nada y romperia la comparacion.
    const tope = topeDeCajaFuerte(TIENDA, 0, true);

    expect(Number.isFinite(tope)).toBe(true);
    expect(Number.isSafeInteger(tope)).toBe(true);
  });

  it("el tope normal sigue siendo pequeno al lado", () => {
    // Deja claro que la excepcion es una excepcion, no el nuevo defecto.
    expect(topeDeCajaFuerte(TIENDA, 0, false)).toBeLessThan(
      topeDeCajaFuerte(TIENDA, 0, true),
    );
  });
});
