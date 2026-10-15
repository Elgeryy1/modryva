import { describe, expect, it } from "vitest";

import { calculadoraDeChecklistDeBienvenida } from "./calculadora-de-bienvenida.js";

describe("calculadoraDeChecklistDeBienvenida", () => {
  it("pide el uso sin argumentos", () => {
    expect(calculadoraDeChecklistDeBienvenida([])).toContain(
      "Uso: /checklist_bienvenida",
    );
  });

  it("pide el uso si falta uno de los tres si/no", () => {
    // `siONo` devuelve `undefined`, no `false`: quien no ha contestado si leyo
    // las reglas no esta diciendo que no las leyo.
    expect(calculadoraDeChecklistDeBienvenida(["si", "si"])).toContain("Uso: ");
  });

  it("con los tres a si, esta completo", () => {
    expect(calculadoraDeChecklistDeBienvenida(["si", "si", "si"])).toContain(
      "Completo",
    );
  });

  it("con alguno a no, incompleto y se ve cual falta", () => {
    const salida = calculadoraDeChecklistDeBienvenida(["si", "no", "si"]);
    expect(salida).toContain("Incompleto");
    expect(salida).toContain("❌");
  });
});
