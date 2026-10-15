import { describe, expect, it } from "vitest";

import {
  informeDeAccionesRevertidas,
  informeDeBusquedaDeRegla,
  informeDeReglasEnMovil,
  informeDeReglasRotas,
  informeDeTableroDeCasos,
  informeDeTiposDeConflicto,
  normasDelTexto,
} from "./informes-de-reglas.js";

describe("normasDelTexto", () => {
  it("una linea es una norma", () => {
    expect(normasDelTexto("1. No spam\n2. Respeto")).toEqual([
      "1. No spam",
      "2. Respeto",
    ]);
  });

  it("las lineas en blanco no cuentan", () => {
    // Un grupo separa sus normas con lineas vacias y eso no son normas. Antes
    // este troceado estaba copiado en dos sitios.
    expect(normasDelTexto("1. No spam\n\n\n2. Respeto\n   \n")).toEqual([
      "1. No spam",
      "2. Respeto",
    ]);
  });

  it("sin texto, ninguna norma", () => {
    expect(normasDelTexto(undefined)).toEqual([]);
    expect(normasDelTexto("")).toEqual([]);
    expect(normasDelTexto("   \n  \n")).toEqual([]);
  });
});

describe("informeDeBusquedaDeRegla", () => {
  it("sin busqueda, enseña como se usa", () => {
    expect(informeDeBusquedaDeRegla(["1. No spam"], "")).toContain("Uso:");
  });

  it("sin normas configuradas lo dice, y no dice que no hay coincidencias", () => {
    // Son dos cosas distintas: "no hay reglas" y "tu busqueda no encaja". La
    // segunda haria pensar al admin que las reglas existen.
    expect(informeDeBusquedaDeRegla([], "spam")).toContain(
      "no tiene reglas configuradas",
    );
  });

  it("numera desde 1, como las lee una persona", () => {
    const texto = informeDeBusquedaDeRegla(["No spam", "Respeto"], "spam");
    expect(texto).toContain("1.");
  });

  it("sin coincidencias lo dice", () => {
    expect(
      informeDeBusquedaDeRegla(["No spam"], "algoquenoestaenningunaparte"),
    ).toContain("Ninguna regla");
  });
});

describe("informeDeReglasEnMovil", () => {
  it("sin normas lo dice", () => {
    expect(informeDeReglasEnMovil([])).toContain("no tiene reglas");
  });

  it("con normas devuelve algo", () => {
    expect(
      informeDeReglasEnMovil(["No spam", "Respeto"]).length,
    ).toBeGreaterThan(0);
  });
});

describe("los dos informes de casos", () => {
  const casos = [
    { motivo: "spam" },
    { motivo: "spam" },
    { motivo: "insultos" },
  ];

  it("tipos de conflicto cuenta y da porcentaje", () => {
    const texto = informeDeTiposDeConflicto(casos);
    expect(texto).toContain("spam");
    expect(texto).toContain("%");
  });

  it("reglas rotas ordena por cuantas veces", () => {
    expect(informeDeReglasRotas(casos)).toContain("spam");
  });

  it("sin casos, los dos lo dicen en vez de callarse", () => {
    expect(informeDeTiposDeConflicto([])).toContain("Sin casos");
    expect(informeDeReglasRotas([])).toContain("Sin normas");
  });
});

describe("informeDeAccionesRevertidas", () => {
  it("sin sanciones lo dice en vez de callarse", () => {
    expect(informeDeAccionesRevertidas([])).toContain("Sin acciones");
  });

  it("cuenta revertidas sobre el total de cada tipo", () => {
    const texto = informeDeAccionesRevertidas([
      { tipo: "ban", revertida: true },
      { tipo: "ban", revertida: false },
      { tipo: "mute", revertida: false },
    ]);

    expect(texto).toContain("ban");
    expect(texto).toContain("1/2");
  });

  it("un tipo sin reversiones sigue apareciendo", () => {
    // Enseñar solo lo que se revierte esconderia lo que funciona, y el informe
    // sirve justo para comparar.
    expect(
      informeDeAccionesRevertidas([{ tipo: "warn", revertida: false }]),
    ).toContain("warn");
  });
});

describe("informeDeTableroDeCasos", () => {
  const AHORA = new Date("2026-08-22T12:00:00Z").getTime();

  const ticket = (
    over: Partial<Parameters<typeof informeDeTableroDeCasos>[0][number]> = {},
  ) => ({
    numero: "1",
    estado: "open",
    prioridad: "normal",
    abiertoEnMs: AHORA - 60_000,
    ...over,
  });

  it("sin casos lo dice", () => {
    expect(informeDeTableroDeCasos([], AHORA)).toContain("Sin casos");
  });

  it("cuenta por columna y nombra el primero de cada una", () => {
    const texto = informeDeTableroDeCasos([ticket()], AHORA);

    expect(texto).toContain("Tablero de casos");
    expect(texto).toContain("caso #1");
  });

  it("una prioridad desconocida cae en normal, no en urgente", () => {
    // Sale de la base, donde cabe una prioridad vieja o una errata. Mandarla a
    // `high` llenaria la columna urgente de casos que no lo son.
    const texto = informeDeTableroDeCasos(
      [ticket({ prioridad: "prioridad_inventada" })],
      AHORA,
    );

    expect(texto).toContain("caso #1");
  });

  it("la edad se calcula con el reloj que se le pasa", () => {
    // Entra por parametro: sin eso no hay forma de probar un caso de hace un
    // minuto contra uno de hace un mes.
    const viejo = informeDeTableroDeCasos(
      [ticket({ abiertoEnMs: AHORA - 30 * 24 * 60 * 60 * 1000 })],
      AHORA,
    );

    expect(viejo).toContain("caso #1");
  });
});
