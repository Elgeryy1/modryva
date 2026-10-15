import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * El contrato entre el analizador Python y el lado TypeScript de Guardian.
 *
 * Son dos procesos en lenguajes distintos que se hablan por HTTP, asi que nada
 * los obliga a coincidir: el compilador de TypeScript no ve el Python y al
 * reves tampoco. Si alguien anade un estado nuevo en un lado, el otro lo
 * rechaza en tiempo de ejecucion —`isProviderStatus` devuelve false— y la
 * verificacion de esa persona acaba en "no evaluada" sin que nadie entienda por
 * que.
 *
 * Este test es lo unico que los ata.
 *
 * OJO con lo que este test NO dice: el reparto de responsabilidades entre los
 * dos SI esta bien y esta documentado en ambos lados. El Python solo elige
 * entre `success` y `uncertain` —deliberadamente conservador, nunca fabrica un
 * exito— y deja el enrutado a revision manual al motor de decision de
 * TypeScript, que es quien tiene los umbrales configurables por chat. No hay
 * politica duplicada; hay un contrato compartido. No lo "unifiques".
 */

const RAIZ = join(__dirname, "..");

/** Los estados que declara el analizador Python. */
const estadosDelPython = (): readonly string[] => {
  const fuente = readFileSync(
    join(RAIZ, "services/guardian-vision-analyzer/app/analyzer.py"),
    "utf8",
  );
  const linea = fuente
    .split("\n")
    .find((l) => l.startsWith("StatusValue = Literal["));
  if (!linea) throw new Error("no encuentro StatusValue en analyzer.py");
  return [...linea.matchAll(/"([a-z_]+)"/g)].map((m) => m[1] ?? "").sort();
};

/** Los estados que declara el tipo de TypeScript. */
const estadosDelTipo = (): readonly string[] => {
  const fuente = readFileSync(
    join(RAIZ, "packages/data/src/guardian-repository.ts"),
    "utf8",
  );
  const inicio = fuente.indexOf("export type GuardianProviderStatusValue =");
  const fin = fuente.indexOf(";", inicio);
  return [...fuente.slice(inicio, fin).matchAll(/"([a-z_]+)"/g)]
    .map((m) => m[1] ?? "")
    .sort();
};

/** Los estados que el guardia en tiempo de ejecucion acepta de verdad. */
const estadosDelGuardia = (): readonly string[] => {
  const fuente = readFileSync(
    join(RAIZ, "modules/guardian/src/providers.ts"),
    "utf8",
  );
  const inicio = fuente.indexOf("const isProviderStatus = (");
  const fin = fuente.indexOf(";", fuente.indexOf("value ===", inicio));
  return [...fuente.slice(inicio, fin).matchAll(/value === "([a-z_]+)"/g)]
    .map((m) => m[1] ?? "")
    .sort();
};

describe("contrato del analizador de vision de Guardian", () => {
  it("Python y el tipo de TypeScript declaran los mismos estados", () => {
    expect(estadosDelPython()).toEqual(estadosDelTipo());
  });

  it("el guardia en ejecucion acepta exactamente los del tipo", () => {
    // Un estado que este en el tipo pero no en el guardia se rechaza en
    // ejecucion aunque compile: el tipo dice que existe y el codigo lo tira.
    expect(estadosDelGuardia()).toEqual(estadosDelTipo());
  });

  it("estan los cinco que se esperan", () => {
    // Ordenados alfabeticamente: "unavailable" va antes que "uncertain".
    expect(estadosDelPython()).toEqual([
      "failed",
      "not_evaluated",
      "success",
      "unavailable",
      "uncertain",
    ]);
  });
});
