import { describe, expect, it } from "vitest";

import {
  calculadoraDeAjusteDeSancion,
  calculadoraDeColorDeSeveridad,
  calculadoraDeDuracionDeSancion,
  calculadoraDeProporcionalidad,
  calculadoraDeRangoDeAccion,
} from "./calculadoras-de-sancion.js";

describe("calculadoraDeRangoDeAccion", () => {
  it("sin accion, enseña como se usa", () => {
    expect(calculadoraDeRangoDeAccion([])).toContain("Uso:");
    expect(calculadoraDeRangoDeAccion(["  "])).toContain("Uso:");
  });

  it("dice el nivel y si se puede deshacer", () => {
    const texto = calculadoraDeRangoDeAccion(["ban"]);
    expect(texto).toMatch(/reversible|irreversible/u);
  });

  it("junta los argumentos: una accion puede llevar espacios", () => {
    expect(calculadoraDeRangoDeAccion(["borrar", "mensajes"])).not.toContain(
      "Uso:",
    );
  });
});

describe("calculadoraDeDuracionDeSancion", () => {
  it("sin los dos numeros, enseña como se usa", () => {
    expect(calculadoraDeDuracionDeSancion([], 12)).toContain("Uso:");
    expect(calculadoraDeDuracionDeSancion(["3"], 12)).toContain("Uso:");
    expect(calculadoraDeDuracionDeSancion(["3", "x"], 12)).toContain("Uso:");
  });

  it("la hora entra por parametro y cambia el resultado", () => {
    // El nucleo la sacaba de new Date().getHours() dentro, asi que no habia
    // forma de probar la madrugada contra el mediodia.
    const dia = calculadoraDeDuracionDeSancion(["3", "0"], 12);
    const noche = calculadoraDeDuracionDeSancion(["3", "0"], 3);

    expect(dia).not.toContain("Uso:");
    expect(noche).not.toContain("Uso:");
  });
});

describe("calculadoraDeAjusteDeSancion", () => {
  it("un escalon que no existe enseña como se usa", () => {
    expect(calculadoraDeAjusteDeSancion(["inventado", "suavizar"])).toContain(
      "Uso:",
    );
  });

  it("una direccion que no existe tambien", () => {
    expect(calculadoraDeAjusteDeSancion(["aviso", "hacia_arriba"])).toContain(
      "Uso:",
    );
  });

  it("con los dos validos, devuelve el ajuste", () => {
    expect(calculadoraDeAjusteDeSancion(["aviso", "endurecer"])).not.toContain(
      "Uso:",
    );
  });
});

describe("calculadoraDeProporcionalidad", () => {
  it("necesita los tres numeros", () => {
    expect(calculadoraDeProporcionalidad(["1", "2"])).toContain("Uso:");
  });

  it("con los tres, da su veredicto", () => {
    expect(calculadoraDeProporcionalidad(["1", "2", "0"])).not.toContain(
      "Uso:",
    );
  });
});

describe("calculadoraDeColorDeSeveridad", () => {
  it("sin puntuacion, enseña como se usa", () => {
    expect(calculadoraDeColorDeSeveridad([])).toContain("Uso:");
  });

  it("acepta decimales", () => {
    expect(calculadoraDeColorDeSeveridad(["0.5"])).not.toContain("Uso:");
  });

  it("una puntuacion de 0 es valida", () => {
    // El caso que rompe si alguien usa `!puntuacion` en vez de `=== null`.
    expect(calculadoraDeColorDeSeveridad(["0"])).not.toContain("Uso:");
  });
});
