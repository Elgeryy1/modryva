import { describe, expect, it } from "vitest";

import {
  type ApelacionParaInforme,
  apelacionesPorIncidente,
  historialDeApelaciones,
  informeDeApelacionesAceptadas,
} from "./informes-apelaciones.js";

const a = (
  parcial: Partial<ApelacionParaInforme> = {},
): ApelacionParaInforme => ({
  aceptada: false,
  caso: "caso-1",
  deUsuario: 7,
  ...parcial,
});

describe("informeDeApelacionesAceptadas", () => {
  it("cuenta solo las aceptadas, y las desglosa por regla", () => {
    const texto = informeDeApelacionesAceptadas([
      a({ aceptada: true, caso: "spam" }),
      a({ aceptada: true, caso: "spam" }),
      a({ aceptada: true, caso: "insultos" }),
      a({ aceptada: false, caso: "spam" }),
    ]);

    expect(texto).toContain("3");
    expect(texto).toContain("spam: 2");
    expect(texto).toContain("insultos: 1");
  });

  it("sin apelaciones no se rompe", () => {
    expect(informeDeApelacionesAceptadas([])).toContain("0");
  });
});

describe("historialDeApelaciones", () => {
  it("da el balance completo, no solo el total", () => {
    // Las tres cifras juntas son lo que hace util el informe: un total suelto
    // no dice si el staff acierta o no.
    const texto = historialDeApelaciones([
      a({ aceptada: true }),
      a({ aceptada: false }),
      a({ aceptada: false }),
    ]);

    expect(texto).toContain("Total: 3");
    expect(texto).toContain("Aceptadas: 1");
    expect(texto).toContain("Rechazadas: 2");
  });
});

describe("apelacionesPorIncidente", () => {
  it("agrupa por caso y dice quien apelo", () => {
    const texto = apelacionesPorIncidente([
      a({ caso: "c-9", deUsuario: 1 }),
      a({ caso: "c-9", deUsuario: 2 }),
    ]);

    expect(texto).toContain("c-9: 2");
    expect(texto).toContain("1");
    expect(texto).toContain("2");
  });

  it("sin nada, lo DICE en vez de contestar en blanco", () => {
    // Un mensaje vacio deja al staff sin saber si no hay apelaciones o si el
    // informe se rompio. Es el caso que mas se olvida y el mas confuso.
    expect(apelacionesPorIncidente([])).toBe("Sin apelaciones registradas.");
  });
});
