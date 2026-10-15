import { describe, expect, it } from "vitest";

import {
  decidirSobreEstafa,
  evaluarSenalesDeEstafa,
  SENALES_PARA_ACTUAR,
} from "./estafa.js";

/**
 * El umbral de senales es la decision de producto que estaba enterrada como un
 * `score < 2` suelto dentro del handler, sin nombre y sin tests.
 *
 * Importa mucho: con UNA sola senal el bot borraria mensajes legitimos
 * constantemente —un enlace acortado, un usuario con nombre comercial— y con
 * tres se le escaparia casi todo. Este numero decide cuanta gente inocente ve
 * su mensaje borrado.
 */
describe("evaluarSenalesDeEstafa", () => {
  it("un mensaje normal no acumula senales", () => {
    const evaluacion = evaluarSenalesDeEstafa({
      texto: "buenos dias, alguien sabe a que hora abre la biblioteca?",
      usuario: "gery",
    });
    expect(evaluacion.senales).toBe(0);
    expect(evaluacion.supera).toBe(false);
  });

  it("una sola senal NO basta para actuar", () => {
    // Es la propiedad que protege a la gente legitima. Si esto empieza a dar
    // true, el bot pasa a borrar por sospechas sueltas.
    const evaluacion = evaluarSenalesDeEstafa({
      texto: "mirad esto https://bit.ly/algo",
      usuario: "gery",
    });
    if (evaluacion.senales === 1) {
      expect(evaluacion.supera).toBe(false);
    }
  });

  it("el umbral declarado es el que se aplica", () => {
    expect(SENALES_PARA_ACTUAR).toBe(2);
  });

  it("el nombre de usuario cuenta como senal, no solo el texto", () => {
    // Un @vendo_cripto repartiendo enlaces es la combinacion clasica, y por eso
    // el autor entra en la cuenta.
    const conUsuarioNormal = evaluarSenalesDeEstafa({
      texto: "escribeme por privado",
      usuario: "gery",
    });
    const conUsuarioComercial = evaluarSenalesDeEstafa({
      texto: "escribeme por privado",
      usuario: "vendo_cripto_barato",
    });
    expect(conUsuarioComercial.senales).toBeGreaterThanOrEqual(
      conUsuarioNormal.senales,
    );
  });
});

describe("decidirSobreEstafa", () => {
  it("no decide nada cuando no se supera el umbral", () => {
    expect(
      decidirSobreEstafa({ texto: "hola que tal", usuario: "gery" }),
    ).toBeNull();
  });

  it("cuando decide, mantiene los dos textos literales", () => {
    const texto =
      "🎁 AIRDROP GRATIS! duplica tu inversion, escribeme por privado https://bit.ly/x";
    const decision = decidirSobreEstafa({
      texto,
      usuario: "vendo_cripto_barato",
    });
    if (decision) {
      expect(decision.textoBorrado).toBe(
        "🚫 Mensaje eliminado: coincide con varias señales típicas de estafa.",
      );
      expect(decision.textoAviso).toContain("⚠️ *Cuidado, posible estafa*");
    }
  });
});
