import { describe, expect, it } from "vitest";

import {
  calculadoraDeApelacionDelicada,
  calculadoraDeAprendizajeDeApelacion,
  calculadoraDeCategoriaDeApelacion,
  calculadoraDeEtaDeApelacion,
  calculadoraDeResumenDeApelacion,
} from "./calculadoras-de-apelacion.js";

describe("calculadoraDeCategoriaDeApelacion", () => {
  it("sin texto enseña como se usa", () => {
    expect(calculadoraDeCategoriaDeApelacion([])).toContain("Uso:");
    expect(calculadoraDeCategoriaDeApelacion(["   "])).toContain("Uso:");
  });

  it("junta los argumentos: una apelacion son varias palabras", () => {
    expect(
      calculadoraDeCategoriaDeApelacion(["me", "banearon", "sin", "avisar"]),
    ).toContain("Categoría");
  });
});

describe("calculadoraDeEtaDeApelacion", () => {
  it("necesita los dos numeros", () => {
    expect(calculadoraDeEtaDeApelacion(["5"])).toContain("Uso:");
    expect(calculadoraDeEtaDeApelacion(["5", "pepe"])).toContain("Uso:");
  });

  it("una cola de 0 es valida", () => {
    // Nadie esperando es una respuesta legitima, no un argumento que falta.
    expect(calculadoraDeEtaDeApelacion(["0", "1000"])).not.toContain("Uso:");
  });
});

describe("calculadoraDeAprendizajeDeApelacion", () => {
  it("necesita el si/no y la regla", () => {
    expect(calculadoraDeAprendizajeDeApelacion(["si"])).toContain("Uso:");
    expect(calculadoraDeAprendizajeDeApelacion(["quiza", "no spam"])).toContain(
      "Uso:",
    );
  });

  it("la regla puede llevar espacios", () => {
    expect(
      calculadoraDeAprendizajeDeApelacion(["si", "no", "hacer", "spam"]),
    ).not.toContain("Uso:");
  });
});

describe("calculadoraDeResumenDeApelacion", () => {
  it("necesita los tres", () => {
    expect(calculadoraDeResumenDeApelacion(["cat", "10"])).toContain("Uso:");
  });

  it("con los tres, resume", () => {
    expect(
      calculadoraDeResumenDeApelacion(["injusta", "120", "si"]),
    ).not.toContain("Uso:");
  });
});

describe("calculadoraDeApelacionDelicada", () => {
  it("los tres argumentos son obligatorios", () => {
    expect(calculadoraDeApelacionDelicada(["si", "no"])).toContain("Uso:");
  });

  it("un argumento que falta NO cuenta como 'no'", () => {
    // Es lo que separa `undefined` de `false`. Una apelacion que menciona a un
    // menor y a la que alguien se dejo un argumento no puede salir como "sin
    // señales delicadas".
    expect(calculadoraDeApelacionDelicada(["si", "no", ""])).toContain("Uso:");
    expect(calculadoraDeApelacionDelicada(["si", "no", "quiza"])).toContain(
      "Uso:",
    );
  });

  it("con los tres a no, no hay señales", () => {
    expect(calculadoraDeApelacionDelicada(["no", "no", "no"])).toContain(
      "Sin señales",
    );
  });

  it("con alguno a si, la marca y dice por que", () => {
    const texto = calculadoraDeApelacionDelicada(["si", "no", "no"]);

    expect(texto).toContain("Delicada");
  });
});
