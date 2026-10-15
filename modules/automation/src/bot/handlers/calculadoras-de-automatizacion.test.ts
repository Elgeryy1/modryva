import { describe, expect, it } from "vitest";

import { calculadoraDeCooldownDeRegla } from "./calculadoras-de-automatizacion.js";

const AHORA = Date.UTC(2026, 7, 24, 12, 0, 0);

describe("calculadoraDeCooldownDeRegla", () => {
  it("pide el uso sin argumentos", () => {
    const salida = calculadoraDeCooldownDeRegla([], AHORA);
    expect(salida).toContain("Uso: /cooldown_regla");
    expect(salida).not.toContain("NaN");
  });

  it("un disparo de hace nada deja la regla en cooldown", () => {
    expect(calculadoraDeCooldownDeRegla(["0"], AHORA)).toContain(
      "Cooldown activo",
    );
  });

  it("uno de hace mucho la deja lista otra vez", () => {
    expect(calculadoraDeCooldownDeRegla(["100000"], AHORA)).toContain(
      "Puede dispararse",
    );
  });

  it("el reloj entra por parametro, no lo lee del proceso", () => {
    // Es lo que permite probar las dos ramas sin congelar nada.
    expect(calculadoraDeCooldownDeRegla(["0"], AHORA)).not.toBe(
      calculadoraDeCooldownDeRegla(["100000"], AHORA),
    );
  });
});
