import { describe, expect, it } from "vitest";

import {
  clasificarAdjuntoPeligroso,
  detectarFugaDeDatos,
} from "./contenido-peligroso.js";

/**
 * Los dos handlers de contenido peligroso, ya fuera del servicio.
 *
 * Lo que mas importa aqui no es la deteccion —esa ya la prueban
 * `dangerous-files.test.ts` y `doxxing-detector.test.ts`— sino que el COPY sea
 * exactamente el que la gente lee en el grupo. Una extraccion no cambia lo que
 * ve nadie, y estos asertos lo garantizan.
 */

describe("clasificarAdjuntoPeligroso", () => {
  it("un fichero inofensivo no decide nada", () => {
    expect(clasificarAdjuntoPeligroso("apuntes.pdf")).toBeNull();
  });

  it("un ejecutable decide borrar, con el motivo dentro del texto", () => {
    const decision = clasificarAdjuntoPeligroso("factura.exe");
    expect(decision).not.toBeNull();
    expect(decision?.textoBorrado).toContain(
      "🚫 Archivo bloqueado por seguridad",
    );
  });

  it("mantiene el aviso literal de cuando el bot no puede borrar", () => {
    const decision = clasificarAdjuntoPeligroso("factura.exe");
    expect(decision?.textoAviso).toBe(
      "⚠️ *Ojo con el archivo de arriba* — parece peligroso (podría ser malware). No lo abras ni lo descargues. No puedo borrarlo porque no soy administrador del grupo.",
    );
  });

  it("un nombre vacio no decide nada", () => {
    expect(clasificarAdjuntoPeligroso("")).toBeNull();
  });
});

describe("detectarFugaDeDatos", () => {
  it("un mensaje normal no decide nada", () => {
    expect(detectarFugaDeDatos("quedamos a las seis")).toBeNull();
  });

  it("mantiene los dos textos literales", () => {
    // Un telefono espanol, que es lo que el detector busca.
    const decision = detectarFugaDeDatos("mi telefono es 612345678");
    expect(decision).not.toBeNull();
    expect(decision?.textoBorrado).toBe(
      "🔒 Mensaje eliminado: parecía contener datos personales (teléfono, correo, DNI o similar).",
    );
    expect(decision?.textoAviso).toBe(
      "⚠️ *Cuidado* — el mensaje de arriba parece contener datos personales (teléfono, correo, DNI o similar). No lo reenvíes. No puedo borrarlo porque no soy administrador del grupo.",
    );
  });
});
