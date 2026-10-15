import { describe, expect, it } from "vitest";

import {
  calculadoraDeConfianzaDeStaff,
  calculadoraDeOwnerAusente,
  calculadoraDeRevisionEntrePares,
} from "./calculadoras-de-staff.js";

describe("calculadoraDeConfianzaDeStaff", () => {
  it("da el uso cuando falta un numero", () => {
    expect(calculadoraDeConfianzaDeStaff(["10"])).toContain("Uso:");
  });

  it("acepta el cero, que no es lo mismo que no contestar", () => {
    // `enteroDelArgumento` devuelve 0, no null: quien no revirtio nada tiene
    // derecho a su nota, y con `Number.isNaN` sobre un parseo suelto tampoco
    // fallaba, pero con `!confirmadas` si habria caido en el uso.
    expect(calculadoraDeConfianzaDeStaff(["0", "0"])).toContain("/100");
  });

  it("puntua sobre 100", () => {
    expect(calculadoraDeConfianzaDeStaff(["9", "1"])).toMatch(
      /🎖️ .+ \(\d+\/100\)/,
    );
  });
});

describe("calculadoraDeRevisionEntrePares", () => {
  it("exige revision cuando un admin sanciona a otro", () => {
    expect(calculadoraDeRevisionEntrePares(["si", "si"])).toContain(
      "revisión obligatoria",
    );
  });

  it("no la exige cuando el autor no es admin", () => {
    expect(calculadoraDeRevisionEntrePares(["no", "si"])).not.toContain(
      "revisión obligatoria",
    );
  });

  it("pide el uso cuando falta el segundo si/no, en vez de suponer que no", () => {
    // Suponer `false` marcaria como "no aplica" un caso que nadie ha contestado.
    expect(calculadoraDeRevisionEntrePares(["si"])).toContain("Uso:");
  });

  it("pide el uso cuando la respuesta no es si ni no", () => {
    expect(calculadoraDeRevisionEntrePares(["quiza", "si"])).toContain("Uso:");
  });
});

describe("calculadoraDeOwnerAusente", () => {
  it("responde distinto segun si el owner esta o no", () => {
    const ausente = calculadoraDeOwnerAusente(["si"]);
    const presente = calculadoraDeOwnerAusente(["no"]);
    expect(ausente).not.toBe(presente);
  });

  it("pide el uso sin argumento", () => {
    expect(calculadoraDeOwnerAusente([])).toContain("Uso:");
  });
});
