import { describe, expect, it } from "vitest";

import {
  calculadoraDeCartaDeMiembro,
  calculadoraDeCompraDeCosmetico,
  calculadoraDeCooldownDinamico,
  calculadoraDeCupoDiario,
  calculadoraDeDobleReputacion,
  calculadoraDeDueloDeDebate,
  calculadoraDeGastoDeEnergia,
  calculadoraDeItemsLegendarios,
  calculadoraDeLogrosDeRacha,
  calculadoraDeLogrosNegativos,
  calculadoraDeLogrosSecretos,
  calculadoraDePatronImposible,
  calculadoraDePrestigio,
  calculadoraDeProgresoDeBoss,
  calculadoraDePruebaAntibot,
  calculadoraDeRachaSinSancion,
  calculadoraDeRecompensaColectiva,
  calculadoraDeSancionDeJuego,
} from "./calculadoras-de-juego.js";

/**
 * Las dieciocho calculadoras comparten forma, asi que lo que se prueba aqui no
 * es la logica de cada detector —esa ya tiene sus tests al lado del detector—
 * sino el borde: que un argumento que falta da el uso y no un `NaN`, y que un
 * `0` legitimo NO se confunde con un argumento ausente.
 */

const TODAS = [
  { f: calculadoraDePruebaAntibot, uso: "/prueba_antibot" },
  { f: calculadoraDeRachaSinSancion, uso: "/racha_sin_sancion" },
  { f: calculadoraDeProgresoDeBoss, uso: "/progreso_boss" },
  { f: calculadoraDeRecompensaColectiva, uso: "/recompensa_colectiva" },
  { f: calculadoraDeCompraDeCosmetico, uso: "/comprar_cosmetico" },
  { f: calculadoraDeCupoDiario, uso: "/cupo_diario" },
  { f: calculadoraDeDueloDeDebate, uso: "/duelo_debate" },
  { f: calculadoraDeDobleReputacion, uso: "/doble_rep" },
  { f: calculadoraDeCooldownDinamico, uso: "/cooldown_dinamico" },
  { f: calculadoraDeGastoDeEnergia, uso: "/gastar_energia" },
  { f: calculadoraDeSancionDeJuego, uso: "/sancion_juego" },
  { f: calculadoraDePatronImposible, uso: "/patron_imposible" },
  { f: calculadoraDeItemsLegendarios, uso: "/items_legendarios" },
  { f: calculadoraDeCartaDeMiembro, uso: "/carta_miembro" },
  { f: calculadoraDeLogrosNegativos, uso: "/logros_negativos" },
  { f: calculadoraDePrestigio, uso: "/prestigio" },
  { f: calculadoraDeLogrosSecretos, uso: "/logros_secretos" },
  { f: calculadoraDeLogrosDeRacha, uso: "/logros_racha" },
] as const;

describe("las calculadoras de juego, sin argumentos", () => {
  it.each(TODAS)("$uso responde con su uso", ({ f, uso }) => {
    const salida = f([]);
    expect(salida).toContain("Uso: ");
    expect(salida).toContain(uso);
    expect(salida).not.toContain("NaN");
  });
});

describe("el cero como argumento legitimo", () => {
  // `enteroDelArgumento` devuelve 0, no `null`: un tope de 0 o una racha de 0
  // dias son respuestas validas, y confundirlas con "no me lo has dicho"
  // esconderia el resultado detras del mensaje de uso.
  it("una racha de 0 dias calcula, no pide el uso", () => {
    expect(calculadoraDeRachaSinSancion(["0"])).not.toContain("Uso: ");
  });

  it("un cupo de 0 calcula, no pide el uso", () => {
    expect(calculadoraDeCupoDiario(["0", "0"])).not.toContain("Uso: ");
  });

  it("un cooldown con abuso 0 calcula, no pide el uso", () => {
    expect(calculadoraDeCooldownDinamico(["0"])).toContain("Cooldown:");
  });
});

describe("calculadoraDePruebaAntibot", () => {
  it("pide el uso si falta la respuesta esperada", () => {
    expect(calculadoraDePruebaAntibot(["7", "", "500"])).toContain("Uso: ");
  });

  it("distingue persona de bot", () => {
    const rapido = calculadoraDePruebaAntibot(["7", "7", "1"]);
    const normal = calculadoraDePruebaAntibot(["7", "7", "3000"]);
    expect(rapido).not.toBe(normal);
  });
});

describe("calculadoraDeCompraDeCosmetico", () => {
  it("dice cuanto falta cuando no llega el saldo", () => {
    expect(calculadoraDeCompraDeCosmetico(["10", "25"])).toContain("15");
  });

  it("acepta precios con decimales", () => {
    expect(calculadoraDeCompraDeCosmetico(["10.5", "2.25"])).toContain("✅");
  });
});

describe("calculadoraDeDobleReputacion", () => {
  it("pide el uso si el si/no no se entiende", () => {
    expect(calculadoraDeDobleReputacion(["10", "quiza", "si"])).toContain(
      "Uso: ",
    );
  });

  it("dobla con el evento activo y la accion util", () => {
    expect(calculadoraDeDobleReputacion(["10", "si", "si"])).toContain(
      "doblados",
    );
  });
});

describe("las tres que piden tres enteros", () => {
  const TRES = [
    { f: calculadoraDeCartaDeMiembro, uso: "/carta_miembro" },
    { f: calculadoraDeLogrosNegativos, uso: "/logros_negativos" },
    { f: calculadoraDeLogrosSecretos, uso: "/logros_secretos" },
  ] as const;

  it.each(TRES)("$uso pide el uso con solo dos", ({ f }) => {
    expect(f(["1", "2"])).toContain("Uso: ");
  });

  it.each(TRES)("$uso calcula con tres ceros", ({ f }) => {
    expect(f(["0", "0", "0"])).not.toContain("Uso: ");
  });
});

describe("las que devuelven listas vacias", () => {
  it("items legendarios sin merecerlos lo dice, no devuelve vacio", () => {
    expect(calculadoraDeItemsLegendarios(["0", "0", "no"])).toContain(
      "Sin ítems legendarios",
    );
  });

  it("logros de racha sin racha lo dice", () => {
    expect(calculadoraDeLogrosDeRacha(["0"])).toContain("Sin logros de racha");
  });
});

describe("calculadoraDeGastoDeEnergia", () => {
  it("no deja gastar mas de lo que hay", () => {
    expect(calculadoraDeGastoDeEnergia(["5", "10", "100"])).toContain("❌");
  });

  it("deja gastar lo que cabe", () => {
    expect(calculadoraDeGastoDeEnergia(["50", "10", "100"])).toContain("⚡");
  });
});

describe("calculadoraDePrestigio", () => {
  it("pide el uso con un solo numero", () => {
    expect(calculadoraDePrestigio(["50"])).toContain("Uso: ");
  });
});

describe("calculadoraDeProgresoDeBoss", () => {
  it("da porcentaje y lo que falta", () => {
    expect(calculadoraDeProgresoDeBoss(["3", "10"])).toMatch(/%/);
  });
});

describe("calculadoraDePatronImposible", () => {
  it("acepta una reaccion media con decimales", () => {
    expect(calculadoraDePatronImposible(["10", "10", "12.5"])).not.toContain(
      "Uso: ",
    );
  });
});

describe("calculadoraDeDueloDeDebate", () => {
  it("nombra ganador y margen", () => {
    expect(calculadoraDeDueloDeDebate(["10", "4"])).toContain("margen");
  });
});

describe("calculadoraDeSancionDeJuego", () => {
  it("nombra la sancion", () => {
    expect(calculadoraDeSancionDeJuego(["0.9"])).toContain("Sanción:");
  });
});

describe("calculadoraDeRecompensaColectiva", () => {
  it("acepta una mejora negativa, que es un dato y no un error", () => {
    expect(calculadoraDeRecompensaColectiva(["-0.2"])).not.toContain("Uso: ");
  });
});
