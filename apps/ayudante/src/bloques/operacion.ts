import type {
  AyudanteWatchdogRepository,
  MedicionWatchdog,
} from "@superbot/data";
import type {
  CatalogoDeManejadores,
  ManejadorDeSolicitud,
} from "../despachador.js";

// ---------------------------------------------------------------------------
// Lectura de payload -- la cola guarda JSON (`Json` en Prisma), asi que todo
// lo que llega a un manejador es `unknown` y hay que validarlo a mano antes
// de tocarlo. Mismo patron que `bloques/identidad.ts` y `bloques/censo.ts`.
// ---------------------------------------------------------------------------

const comoRegistro = (payload: unknown): Record<string, unknown> => {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("payload invalido: se esperaba un objeto");
  }
  return payload as Record<string, unknown>;
};

const comoBigInt = (valor: unknown, campo: string): bigint => {
  if (typeof valor === "number" && Number.isInteger(valor)) {
    return BigInt(valor);
  }
  if (typeof valor === "string" && /^-?\d+$/u.test(valor)) {
    return BigInt(valor);
  }
  throw new Error(`payload invalido: "${campo}" no es un entero valido`);
};

const comoListaDeTextos = (valor: unknown, campo: string): string[] => {
  if (!Array.isArray(valor) || valor.length === 0) {
    throw new Error(`payload invalido: "${campo}" no es una lista valida`);
  }
  return valor.map((elemento, indice) => {
    if (typeof elemento !== "string" || elemento.length === 0) {
      throw new Error(
        `payload invalido: "${campo}[${indice}]" no es un texto valido`,
      );
    }
    return elemento;
  });
};

// ---------------------------------------------------------------------------
// 1 y 2. operacion.watchdog_ping
// ---------------------------------------------------------------------------

/**
 * Umbral de latencia del ping, en milisegundos, a partir del cual se avisa
 * aunque el bot SI haya respondido. `packages/telegram/src/gateway.ts` da 20 s
 * de margen a la Bot API porque un envio normal ronda las decimas; un ping
 * -la operacion mas ligera que existe- que tarda mas de 5 s ya esta muy lejos
 * de esa normalidad, y no hace falta esperar a los 20 s del timeout real para
 * saber que algo va mal.
 */
export const UMBRAL_LATENCIA_MS = 5000;

/**
 * Cuantas mediciones seguidas tienen que fallar antes de hablar de una
 * "caida sostenida" en vez de un fallo puntual. Con 1 sola medicion, un
 * `FLOOD_WAIT` pasajero de la propia cuenta del ayudante -que no dice nada
 * del bot- ya dispararia alerta; con 3, hace falta que el patron se repita en
 * tres barridos consecutivos del watchdog para que se considere confirmado.
 */
export const UMBRAL_CAIDAS_CONSECUTIVAS = 3;

/**
 * Pura: dado un historial de mediciones ya ordenado de mas reciente a mas
 * antigua (el orden que promete `AyudanteWatchdogRepository.ultimas`), dice
 * si las ultimas `UMBRAL_CAIDAS_CONSECUTIVAS` fueron todas un fallo. Menos
 * mediciones que el umbral no son evidencia suficiente de una caida sostenida
 * -podria ser que el watchdog acabe de arrancar- asi que no alertan.
 */
export const decidirSiAlertarPorCaida = (
  ultimasMediciones: readonly MedicionWatchdog[],
): boolean => {
  if (ultimasMediciones.length < UMBRAL_CAIDAS_CONSECUTIVAS) return false;
  return ultimasMediciones
    .slice(0, UMBRAL_CAIDAS_CONSECUTIVAS)
    .every((medicion) => !medicion.ok);
};

export interface RepositoriosDeOperacion {
  readonly watchdog: AyudanteWatchdogRepository;
}

export interface ResultadoWatchdogPing {
  readonly ok: boolean;
  readonly latenciaMs: number | null;
  readonly alerta: boolean;
  readonly motivo: string | null;
}

/**
 * `operacion.watchdog_ping`: mide cuanto tarda el bot en contestar desde
 * fuera de su propio proceso, registra la medicion, y combina dos señales
 * distintas de alerta:
 *
 * - Inmediata: este ping en concreto fallo, o tardo mas de
 *   `UMBRAL_LATENCIA_MS`.
 * - Sostenida: `decidirSiAlertarPorCaida` sobre el historial que acaba de
 *   quedar registrado, para distinguir un fallo puntual de una caida real.
 *
 * Las dos pueden darse a la vez -un fallo puntual muy lento que ademas
 * resulta ser el tercero seguido- y entonces el motivo las junta.
 */
const watchdogPing = (repos: RepositoriosDeOperacion): ManejadorDeSolicitud => {
  return async (payload, contexto) => {
    const datos = comoRegistro(payload);
    const chatId = comoBigInt(datos.chatId, "chatId");

    const medicion = await contexto.userbot.ping(chatId);
    await repos.watchdog.registrar({
      latenciaMs: medicion.latenciaMs,
      ok: medicion.ok,
    });

    const motivos: string[] = [];
    if (!medicion.ok) {
      motivos.push("el bot no respondio al ping");
    } else if (
      medicion.latenciaMs !== null &&
      medicion.latenciaMs > UMBRAL_LATENCIA_MS
    ) {
      motivos.push(
        `la latencia (${medicion.latenciaMs} ms) supera el umbral de ${UMBRAL_LATENCIA_MS} ms`,
      );
    }

    const ultimas = await repos.watchdog.ultimas(UMBRAL_CAIDAS_CONSECUTIVAS);
    if (decidirSiAlertarPorCaida(ultimas)) {
      motivos.push(
        `las ultimas ${UMBRAL_CAIDAS_CONSECUTIVAS} mediciones seguidas fallaron`,
      );
    }

    contexto.logger.info(
      {
        chatId,
        ok: medicion.ok,
        latenciaMs: medicion.latenciaMs,
        alerta: motivos.length > 0,
      },
      "operacion: ping de watchdog registrado",
    );

    const resultado: ResultadoWatchdogPing = {
      ok: medicion.ok,
      latenciaMs: medicion.latenciaMs,
      alerta: motivos.length > 0,
      motivo: motivos.length > 0 ? motivos.join("; ") : null,
    };
    return resultado;
  };
};

// ---------------------------------------------------------------------------
// 3. operacion.sonda_despliegue
// ---------------------------------------------------------------------------

export interface ResultadoSondaComando {
  readonly comando: string;
  readonly respondioOk: boolean;
}

/**
 * `operacion.sonda_despliegue`: comprueba, tras un despliegue, que el bot
 * sigue vivo para una lista de comandos que se espera que existan.
 *
 * LIMITACION (ver "advertencias" al entregar el bloque): `UserbotPort` no
 * tiene ningun metodo para enviar un comando de verdad y leer la respuesta
 * del bot a ESE comando -eso exigiria mandar un mensaje real al chat y
 * despues leer el historial para saber si el bot contesto, lo que roza
 * "escribir como si fuera un miembro" sin estarlo pidiendo el plan-, asi
 * que esto usa un `ping` por cada nombre de comando como aproximacion de
 * "el proceso del bot esta vivo". No confirma que ESE comando en concreto
 * funcione, solo que el bot en general responde en el momento de la sonda.
 */
const sondaDespliegue = (): ManejadorDeSolicitud => {
  return async (payload, contexto) => {
    const datos = comoRegistro(payload);
    const chatId = comoBigInt(datos.chatId, "chatId");
    const comandos = comoListaDeTextos(datos.comandos, "comandos");

    const resultados: ResultadoSondaComando[] = [];
    for (const comando of comandos) {
      const medicion = await contexto.userbot.ping(chatId);
      resultados.push({ comando, respondioOk: medicion.ok });
    }

    contexto.logger.info(
      { chatId, comandos: comandos.length },
      "operacion: sonda de despliegue completada",
    );

    return resultados;
  };
};

/** El catalogo del bloque, con el repositorio ya inyectado. */
export const manejadoresDeOperacion = (
  repos: RepositoriosDeOperacion,
): CatalogoDeManejadores => ({
  "operacion.watchdog_ping": watchdogPing(repos),
  "operacion.sonda_despliegue": sondaDespliegue(),
});
