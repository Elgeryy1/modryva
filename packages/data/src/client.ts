import { PrismaClient } from "@prisma/client";
import { createLogger } from "@superbot/shared";
import { prismaLogLevel } from "./prisma-log.js";

export type { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaClient: PrismaClient | undefined;
}

const logger = createLogger("prisma");

/**
 * Los avisos y errores de Prisma salen por NUESTRO logger, no por su stderr.
 *
 * Antes iban a stderr en texto plano multilínea, fuera del JSON de pino: en
 * producción eso significaba que contando por nivel el bot aparecía con CERO
 * errores mientras acumulaba 94 en 40 h. Una alerta montada sobre `"level":50`
 * estaba ciega a cualquier fallo de base de datos.
 *
 * Y ya que pasan por aquí, los choques de clave única bajan a `debug` — ver
 * `prisma-log.ts` para por qué eso no pierde nada.
 */
const nuevoCliente = (): PrismaClient => {
  const client = new PrismaClient({
    // El default de Prisma (5 s por transaccion interactiva) esta pensado para
    // un disco que responde. El NAS no siempre lo es: sus picos de I/O (un
    // checkpoint de Postgres llego a tardar 159 s en escribir) hicieron caducar
    // transacciones triviales de dos consultas con P2028 — la peor observada
    // necesito 14,5 s (2026-08-13, `/robar` sin respuesta y moneda de
    // actividad sin abonar). 30 s es el doble de ese peor caso; `maxWait` sube
    // menos porque el pool no es el problema (25 de 100 conexiones).
    transactionOptions: { maxWait: 10_000, timeout: 30_000 },
    log: [
      { emit: "event", level: "warn" },
      { emit: "event", level: "error" },
    ],
  });
  client.$on("warn", (event) => {
    logger.warn({ target: event.target }, event.message);
  });
  client.$on("error", (event) => {
    const detalle = { target: event.target };
    if (prismaLogLevel(event.message) === "debug") {
      logger.debug(detalle, event.message);
      return;
    }
    logger.error(detalle, event.message);
  });
  return client as unknown as PrismaClient;
};

export const prisma = globalThis.prismaClient ?? nuevoCliente();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaClient = prisma;
}
