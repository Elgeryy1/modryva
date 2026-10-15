import type { AyudanteSolicitudRepository } from "@superbot/data";
import type { createLogger } from "@superbot/shared";
import type { UserbotPort } from "./userbot-port.js";

/** El logger de pino que reparte `@superbot/shared`. */
type Logger = ReturnType<typeof createLogger>;

/**
 * Lo que le llega a un manejador de bloque: el `payload` de la solicitud, ya
 * suelto, y el puerto del userbot para hacer lo que haga falta.
 *
 * Nunca Prisma directo, nunca `@superbot/data` más allá de lo que el propio
 * bloque necesite inyectar explícitamente en su fábrica — el mismo principio
 * que separa un módulo del núcleo, aplicado aquí a un bloque del ayudante.
 */
export interface ContextoDeManejador {
  readonly userbot: UserbotPort;
  readonly logger: Logger;
}

export type ManejadorDeSolicitud = (
  payload: unknown,
  contexto: ContextoDeManejador,
) => Promise<unknown>;

/** Un tipo de solicitud, con su manejador. Cada bloque exporta un puñado de estos y `index.ts` los junta. */
export type CatalogoDeManejadores = Readonly<
  Record<string, ManejadorDeSolicitud>
>;

/** Cuántas veces se reintenta una solicitud antes de darla por fallida. */
const MAX_INTENTOS = 3;

/**
 * Convierte los `bigint` de un resultado a texto, en profundidad.
 *
 * `AyudanteSolicitud.resultado` es una columna `Json`, y JSON no sabe
 * representar un `bigint`: `JSON.stringify({ids:[1n]})` lanza "Do not know how
 * to serialize a BigInt". Media docena de manejadores devuelven ids de
 * Telegram, que son `bigint` en todo el repo, asi que sin esta conversion el
 * despachador reventaria AL GUARDAR -- despues de que el manejador ya hubiera
 * hecho su trabajo. El efecto ya estaria aplicado, el resultado se perderia, y
 * el reintento repetiria el efecto tres veces antes de darse por fallido.
 *
 * A texto y no a `number`: un id de Telegram cabe hoy en un entero seguro de
 * JavaScript, pero apoyarse en eso es apostar a que Telegram no crezca.
 */
export const aJsonSeguro = (valor: unknown): unknown => {
  if (typeof valor === "bigint") return valor.toString();
  if (Array.isArray(valor)) return valor.map(aJsonSeguro);
  if (valor instanceof Date) return valor.toISOString();
  if (valor !== null && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>).map(([clave, dato]) => [
        clave,
        aJsonSeguro(dato),
      ]),
    );
  }
  return valor;
};

const dormir = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * El bucle de la cola: reclama, despacha por `tipo`, marca el resultado.
 *
 * Un `tipo` sin manejador registrado **no se reintenta**: es un error de
 * despliegue (código nuevo esperado que no llegó, o un `tipo` mal escrito), no
 * un fallo transitorio, y reintentarlo indefinidamente solo lo escondería.
 */
export const despacharLote = async (input: {
  readonly repositorio: AyudanteSolicitudRepository;
  readonly catalogo: CatalogoDeManejadores;
  readonly contexto: ContextoDeManejador;
  readonly lote: number;
}): Promise<{ readonly procesadas: number }> => {
  const solicitudes = await input.repositorio.reclamarLote(input.lote);
  for (const solicitud of solicitudes) {
    const manejador = input.catalogo[solicitud.tipo];
    if (!manejador) {
      await input.repositorio.marcarFallo({
        id: solicitud.id,
        error: `tipo de solicitud desconocido: ${solicitud.tipo}`,
        definitivo: true,
      });
      input.contexto.logger.error(
        { tipo: solicitud.tipo, id: solicitud.id },
        "solicitud de tipo desconocido para el ayudante",
      );
      continue;
    }

    try {
      const resultado = await manejador(solicitud.payload, input.contexto);
      await input.repositorio.marcarHecha(
        solicitud.id,
        aJsonSeguro(resultado ?? null),
      );
    } catch (error) {
      const definitivo = solicitud.intentos + 1 >= MAX_INTENTOS;
      await input.repositorio.marcarFallo({
        id: solicitud.id,
        error: error instanceof Error ? error.message : String(error),
        definitivo,
      });
      input.contexto.logger.warn(
        { error, tipo: solicitud.tipo, id: solicitud.id, definitivo },
        "fallo atendiendo una solicitud del ayudante",
      );
    }
  }
  return { procesadas: solicitudes.length };
};

/** Arranca el bucle. No termina nunca: vive lo que viva el proceso. */
export const arrancarCola = async (input: {
  readonly repositorio: AyudanteSolicitudRepository;
  readonly catalogo: CatalogoDeManejadores;
  readonly contexto: ContextoDeManejador;
  readonly intervaloMs: number;
  readonly lote: number;
}): Promise<never> => {
  for (;;) {
    try {
      await despacharLote({
        repositorio: input.repositorio,
        catalogo: input.catalogo,
        contexto: input.contexto,
        lote: input.lote,
      });
    } catch (error) {
      input.contexto.logger.warn(
        { error },
        "fallo reclamando la cola del ayudante",
      );
    }
    await dormir(input.intervaloMs);
  }
};
