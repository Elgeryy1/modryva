import { describe, expect, it } from "vitest";

// PR de demostración: esta prueba falla A PROPÓSITO para enseñar cómo la
// branch protection bloquea el merge cuando la CI está en rojo.
// Para arreglarla, bastaría con esperar 5 (o borrar este fichero).
describe("demo CI (falla a propósito)", () => {
  it("suma 2 + 2 y espera 5 — mal adrede", () => {
    const suma = 2 + 2;
    expect(suma).toBe(5);
  });
});
