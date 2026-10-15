import { describe, expect, it } from "vitest";

import {
  calculadoraDeChecklistDeOwner,
  calculadoraDeMentorDeOwner,
  calculadoraDeResumenDeOwner,
} from "./calculadoras-de-owner.js";

describe("calculadoraDeChecklistDeOwner", () => {
  it("necesita los tres numeros", () => {
    expect(calculadoraDeChecklistDeOwner(["1", "2"])).toContain("Uso:");
    expect(calculadoraDeChecklistDeOwner(["1", "2", "pepe"])).toContain("Uso:");
  });

  it("con los tres, marca lo hecho y lo pendiente", () => {
    const texto = calculadoraDeChecklistDeOwner(["0", "0", "1"]);

    expect(texto).not.toContain("Uso:");
    expect(texto).toMatch(/✅|❌/u);
  });

  it("todo a cero es una entrada valida, no un argumento que falta", () => {
    // Un owner al dia tiene cero apelaciones y cero incidencias. Confundir eso
    // con "no me has dicho nada" le negaria el comando justo cuando va bien.
    expect(calculadoraDeChecklistDeOwner(["0", "0", "0"])).not.toContain(
      "Uso:",
    );
  });
});

describe("calculadoraDeMentorDeOwner", () => {
  it("necesita el numero y los dos si/no", () => {
    expect(calculadoraDeMentorDeOwner(["100", "si"])).toContain("Uso:");
    expect(calculadoraDeMentorDeOwner(["100", "quiza", "no"])).toContain(
      "Uso:",
    );
  });

  it("con los tres, aconseja", () => {
    expect(calculadoraDeMentorDeOwner(["100", "si", "no"])).not.toContain(
      "Uso:",
    );
  });
});

describe("calculadoraDeResumenDeOwner", () => {
  it("necesita los tres numeros", () => {
    expect(calculadoraDeResumenDeOwner(["1"])).toContain("Uso:");
  });

  it("con los tres, resume", () => {
    expect(calculadoraDeResumenDeOwner(["2", "1", "5"])).not.toContain("Uso:");
  });
});
