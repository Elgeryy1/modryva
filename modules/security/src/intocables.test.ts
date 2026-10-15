import { describe, expect, it } from "vitest";

import { esIntocable, textoIntocable } from "./intocables.js";

describe("esIntocable", () => {
  it("reconoce a quien esta en la lista", () => {
    expect(esIntocable(42n, [7n, 42n, 99n])).toBe(true);
  });

  it("deja fuera a quien no esta", () => {
    expect(esIntocable(43n, [7n, 42n, 99n])).toBe(false);
  });

  it("con la lista vacia no hay intocables", () => {
    // El caso por defecto: sin la variable de entorno puesta, el bot se
    // comporta exactamente como antes de que esto existiera.
    expect(esIntocable(42n, [])).toBe(false);
  });

  it("un update sin autor NO es intocable", () => {
    // Lo contrario convertiria cualquier hueco en los datos —un canal, un
    // mensaje de servicio, un envelope a medio normalizar— en un agujero por
    // el que no se sanciona a nadie.
    expect(esIntocable(undefined, [7n, 42n])).toBe(false);
  });

  it("compara por valor, no por identidad de BigInt", () => {
    // `new Set<bigint>().has()` y `===` sobre bigint van por valor, pero un
    // `indexOf` sobre objetos no. Este test clava que la lista puede venir de
    // sitios distintos (env parseado, literal en un test) y sigue casando.
    expect(esIntocable(BigInt("9007199254740993"), [9007199254740993n])).toBe(
      true,
    );
  });
});

describe("textoIntocable", () => {
  it("dice la accion y a quien, y no se inventa un exito", () => {
    const texto = textoIntocable("ban", "@fulano");
    expect(texto).toContain("banear a @fulano");
    expect(texto).toContain("no toco");
  });

  it("conjuga con el mismo vocabulario que la negativa por administrador", () => {
    // Si esto se duplicara, un dia diria "silenciar a" en un sitio y
    // "silenciar" en el otro sobre el mismo comando.
    expect(textoIntocable("mute", "@fulano")).toContain("silenciar a @fulano");
    expect(textoIntocable("unmute", "@fulano")).toContain(
      "quitarle el silencio a @fulano",
    );
  });

  it("no filtra el nombre de la variable de entorno", () => {
    // Un moderador cualquiera no tiene por que enterarse de como se llama la
    // variable ni de que existe: es informacion de despliegue en un mensaje de
    // grupo. Que sepa que no se cambia desde ahi es suficiente.
    expect(textoIntocable("warn", "@fulano")).not.toContain("SUPERBOT_");
  });
});
