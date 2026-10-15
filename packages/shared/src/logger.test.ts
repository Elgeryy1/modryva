import { describe, expect, it } from "vitest";
import { createLogger } from "./logger.js";

/**
 * Captura lo emitido para poder afirmar sobre el JSON real. Ver el comentario
 * de `destination` en logger.ts: interceptar stdout no funciona con pino.
 */
const capturar = () => {
  const lineas: string[] = [];
  const logger = createLogger("test", "info", {
    write: (linea: string) => {
      lineas.push(linea);
    },
  });
  const ultima = () => JSON.parse(lineas.at(-1) ?? "{}");
  return { logger, ultima };
};

describe("createLogger", () => {
  // El caso que motivó esto: el consultor logueó `{"error":{}}` y el único
  // fallo en tres días quedó ilegible. Un Error tiene message/stack no
  // enumerables y sin serializador se queda en objeto vacío.
  it.each([
    "error",
    "err",
  ] as const)("serializa un Error bajo la clave %s con message y stack", (clave) => {
    const { logger, ultima } = capturar();
    logger.warn({ [clave]: new Error("boom") }, "fallo");
    const emitido = ultima()[clave];
    expect(emitido.message).toBe("boom");
    expect(emitido.stack).toContain("boom");
  });

  it("la redaccion sigue funcionando con los serializadores puestos", () => {
    const { logger, ultima } = capturar();
    logger.info({ token: "secreto", visible: "si" }, "con token");
    const emitido = ultima();
    expect(emitido.token).toBeUndefined();
    expect(emitido.visible).toBe("si");
  });
});
