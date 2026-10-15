import { describe, expect, it } from "vitest";

import {
  calculadoraDeBurnoutDeStaff,
  calculadoraDeEscaladaAlOwner,
} from "./calculadoras-de-staff.js";

const AHORA = Date.UTC(2026, 7, 22, 12, 0, 0);

describe("calculadoraDeBurnoutDeStaff", () => {
  it("pide el uso cuando faltan numeros", () => {
    expect(calculadoraDeBurnoutDeStaff(["4"])).toContain("Uso:");
  });

  it("admite horas con decimales", () => {
    expect(calculadoraDeBurnoutDeStaff(["12", "7.5"])).not.toContain("Uso:");
  });
});

describe("calculadoraDeEscaladaAlOwner", () => {
  it("escala cuando nadie respondio y la alerta lleva mucho abierta", () => {
    expect(calculadoraDeEscaladaAlOwner(["120"], AHORA)).toContain(
      "Escalar al owner",
    );
  });

  it("no escala si la alerta acaba de saltar", () => {
    expect(calculadoraDeEscaladaAlOwner(["1"], AHORA)).toContain(
      "dentro del margen",
    );
  });

  it("no escala si alguien respondio despues de la alerta", () => {
    // Alerta hace 120 min, respuesta hace 10: la respuesta es posterior.
    expect(calculadoraDeEscaladaAlOwner(["120", "10"], AHORA)).toContain(
      "dentro del margen",
    );
  });

  it("escala si la unica respuesta es anterior a la alerta", () => {
    // Alerta hace 120 min, respuesta hace 200: contesto a otra cosa.
    expect(calculadoraDeEscaladaAlOwner(["120", "200"], AHORA)).toContain(
      "Escalar al owner",
    );
  });

  it("trata el segundo argumento ilegible como que nadie respondio", () => {
    // No es lo mismo que "respondieron hace 0 minutos": ahi si escala.
    expect(calculadoraDeEscaladaAlOwner(["120", "ayer"], AHORA)).toContain(
      "Escalar al owner",
    );
  });

  it("un 0 explicito SI cuenta como respuesta de ahora mismo", () => {
    expect(calculadoraDeEscaladaAlOwner(["120", "0"], AHORA)).toContain(
      "dentro del margen",
    );
  });

  it("pide el uso sin argumentos", () => {
    expect(calculadoraDeEscaladaAlOwner([], AHORA)).toContain("Uso:");
  });
});
