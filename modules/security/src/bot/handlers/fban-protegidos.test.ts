import { describe, expect, it, vi } from "vitest";

import {
  textoDeVetoDeFban,
  type VetoDeFban,
  vetoParaFbanear,
} from "./fban-protegidos.js";

/**
 * Un `fban` echa a alguien de TODOS los grupos de la federacion a la vez, asi
 * que estas cuatro guardas son lo unico que impide usarlo hacia dentro. No
 * tenian ni un test.
 */

const DUENO = 100n;
const ADMIN = 200n;
const CUALQUIERA = 300n;
const BOT = 999n;

const entrada = (
  parcial: Partial<Parameters<typeof vetoParaFbanear>[0]> = {},
) => ({
  objetivo: CUALQUIERA,
  quienPide: ADMIN,
  duenoDeLaFederacion: DUENO,
  idDelBot: BOT,
  objetivoEsAdmin: async () => false,
  ...parcial,
});

describe("a quien no se puede fbanear", () => {
  it("al dueño de la federacion, ni siquiera otro admin", async () => {
    expect(await vetoParaFbanear(entrada({ objetivo: DUENO }))).toBe(
      "es-el-dueno",
    );
  });

  it("a uno mismo", async () => {
    expect(
      await vetoParaFbanear(entrada({ objetivo: ADMIN, quienPide: ADMIN })),
    ).toBe("eres-tu");
  });

  it("al propio bot", async () => {
    // Si el bot se banea a si mismo se queda sin poder deshacerlo.
    expect(await vetoParaFbanear(entrada({ objetivo: BOT }))).toBe("soy-yo");
  });

  it("a otro admin, si quien pide no es el dueño", async () => {
    expect(
      await vetoParaFbanear(entrada({ objetivoEsAdmin: async () => true })),
    ).toBe("es-otro-admin");
  });

  it("pero el dueño SI puede fbanear a un admin", async () => {
    // Es la mitad que da sentido a la anterior: la jerarquia existe.
    expect(
      await vetoParaFbanear(
        entrada({ quienPide: DUENO, objetivoEsAdmin: async () => true }),
      ),
    ).toBeNull();
  });

  it("a alguien normal si se puede", async () => {
    expect(await vetoParaFbanear(entrada())).toBeNull();
  });
});

describe("el orden de los vetos es comportamiento", () => {
  it("el dueño manda sobre 'eres tu' cuando el dueño se lo hace a si mismo", async () => {
    // Los dos aplican. Se dice el primero, y son mensajes que mandan a la
    // persona a sitios distintos.
    expect(
      await vetoParaFbanear(entrada({ objetivo: DUENO, quienPide: DUENO })),
    ).toBe("es-el-dueno");
  });

  it("'eres tu' manda sobre 'es otro admin'", async () => {
    expect(
      await vetoParaFbanear(
        entrada({
          objetivo: ADMIN,
          quienPide: ADMIN,
          objetivoEsAdmin: async () => true,
        }),
      ),
    ).toBe("eres-tu");
  });
});

describe("la consulta de admin solo se hace si hace falta", () => {
  it("no se consulta cuando ya hay veto por otro motivo", async () => {
    // Es una llamada a la base de datos. El codigo original solo la hacia si
    // quien pedia no era el dueño, y pasarla ya resuelta obligaria a
    // consultarla siempre.
    const objetivoEsAdmin = vi.fn(async () => true);

    await vetoParaFbanear(entrada({ objetivo: DUENO, objetivoEsAdmin }));

    expect(objetivoEsAdmin).not.toHaveBeenCalled();
  });

  it("tampoco cuando quien pide es el dueño", async () => {
    const objetivoEsAdmin = vi.fn(async () => true);

    await vetoParaFbanear(entrada({ quienPide: DUENO, objetivoEsAdmin }));

    expect(objetivoEsAdmin).not.toHaveBeenCalled();
  });
});

describe("textoDeVetoDeFban", () => {
  it("cada veto dice algo distinto", () => {
    const vetos: readonly VetoDeFban[] = [
      "es-el-dueno",
      "eres-tu",
      "soy-yo",
      "es-otro-admin",
    ];
    const textos = vetos.map(textoDeVetoDeFban);

    expect(new Set(textos).size).toBe(vetos.length);
  });

  it("el del admin dice a QUIEN hay que pedirselo", () => {
    // Sin eso, quien lo intenta no sabe que hacer despues.
    expect(textoDeVetoDeFban("es-otro-admin")).toContain("dueño");
  });
});
