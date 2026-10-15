import type {
  AyudanteCensoRepository,
  AyudanteIdentidadRepository,
  CoincidenciaDeAvatar,
} from "@superbot/data";
import type {
  CatalogoDeManejadores,
  ManejadorDeSolicitud,
} from "../despachador.js";
import type { FichaCompleta, UserbotPort } from "../userbot-port.js";

// ---------------------------------------------------------------------------
// 1. Puntuacion de riesgo de ingreso
// ---------------------------------------------------------------------------

export interface RiesgoDeIngresoInput {
  readonly antiguedadEstimadaDias: number | null;
  readonly tieneFoto: boolean;
  readonly chatsEnComun: number;
  readonly esPremium: boolean;
}

export interface RiesgoDeIngreso {
  readonly puntuacion: number;
  readonly señales: readonly string[];
}

/** Cuenta creada hace menos de 3 dias: la señal mas fuerte de las cuatro. */
const PESO_CUENTA_MUY_NUEVA = 40;
/** Menos de un mes: todavia reciente, pero ya ha podido usarse en algo. */
const PESO_CUENTA_RECIENTE = 20;
/**
 * No poder estimar la antiguedad no es lo mismo que saber que es nueva, asi
 * que pesa menos que las dos anteriores: es incertidumbre, no una señal en
 * si misma.
 */
const PESO_ANTIGUEDAD_DESCONOCIDA = 10;
/**
 * Sin foto no es sospechoso por si solo -- mucha gente legitima no pone
 * ninguna --, pero combinado con lo demas suma: quien crea cuentas en serie
 * no se para a subir un avatar a cada una.
 */
const PESO_SIN_FOTO = 15;
/**
 * Cero chats en comun es el rastro que falta de una cuenta usada de verdad
 * antes de hoy: nadie legitimo con meses en Telegram llega a un grupo activo
 * sin haber coincidido nunca en otro sitio. Pesa casi tanto como la cuenta
 * muy nueva.
 */
const PESO_CERO_CHATS_COMUNES = 25;
/** Un chat en comun ya rompe el patron de "cuenta creada para esto solo". */
const PESO_UN_CHAT_COMUN = 5;
/**
 * Premium exige un metodo de pago validado por Telegram: friccion real para
 * quien crea cuentas desechables. Resta, nunca suma, y nunca deja la
 * puntuacion por debajo de cero -- no es una señal de sospecha al reves, solo
 * atenua las que ya hay.
 */
const DESCUENTO_PREMIUM = 10;

/**
 * Pura: mismo input, mismo resultado, sin tocar ni el reloj ni la base de
 * datos. La puntuacion es una suma de pesos independientes, no un modelo
 * entrenado -- cada peso tiene su motivo escrito arriba, y sumarlos deja ver
 * a simple vista por que una cuenta puntua lo que puntua.
 */
export const evaluarRiesgoDeIngreso = (
  input: RiesgoDeIngresoInput,
): RiesgoDeIngreso => {
  let puntuacion = 0;
  const señales: string[] = [];

  if (input.antiguedadEstimadaDias === null) {
    puntuacion += PESO_ANTIGUEDAD_DESCONOCIDA;
    señales.push("antigüedad de la cuenta desconocida");
  } else if (input.antiguedadEstimadaDias < 3) {
    puntuacion += PESO_CUENTA_MUY_NUEVA;
    señales.push("cuenta creada hace menos de 3 días");
  } else if (input.antiguedadEstimadaDias < 30) {
    puntuacion += PESO_CUENTA_RECIENTE;
    señales.push("cuenta creada hace menos de un mes");
  }

  if (!input.tieneFoto) {
    puntuacion += PESO_SIN_FOTO;
    señales.push("sin foto de perfil");
  }

  if (input.chatsEnComun === 0) {
    puntuacion += PESO_CERO_CHATS_COMUNES;
    señales.push("cero chats en común");
  } else if (input.chatsEnComun === 1) {
    puntuacion += PESO_UN_CHAT_COMUN;
    señales.push("un solo chat en común");
  }

  if (input.esPremium) {
    puntuacion = Math.max(0, puntuacion - DESCUENTO_PREMIUM);
  }

  return { puntuacion, señales };
};

// ---------------------------------------------------------------------------
// Lectura de payload -- la cola guarda JSON (`Json` en Prisma), asi que todo
// lo que llega a un manejador es `unknown` y hay que validarlo a mano antes
// de tocarlo. Los enteros llegan como `number` o como texto numerico: da
// igual como los serialice quien encole, mientras quepan en un bigint.
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

const comoTexto = (valor: unknown, campo: string): string => {
  if (typeof valor !== "string" || valor.length === 0) {
    throw new Error(`payload invalido: "${campo}" no es un texto valido`);
  }
  return valor;
};

const comoTextoONulo = (valor: unknown, campo: string): string | null =>
  valor === null || valor === undefined ? null : comoTexto(valor, campo);

// ---------------------------------------------------------------------------
// 2 y 3. Los manejadores del bloque
// ---------------------------------------------------------------------------

export interface RepositoriosDeIdentidad {
  readonly identidad: AyudanteIdentidadRepository;
  readonly censo: AyudanteCensoRepository;
}

export interface ResultadoDetectarMulticuenta {
  readonly hash: string | null;
  readonly coincidencias: readonly CoincidenciaDeAvatar[];
}

/**
 * `identidad.detectar_multicuenta`: hash del avatar actual, lo registra, y
 * busca que otras cuentas han llevado alguna vez el mismo hash.
 *
 * Sin foto no hay nada que comparar. No es un fallo -- fallar aqui
 * reintentaria una solicitud que nunca va a tener mas datos -- asi que se
 * devuelve un resultado vacio y no se llega a tocar el repositorio.
 */
const detectarMulticuenta = (
  repos: RepositoriosDeIdentidad,
): ManejadorDeSolicitud => {
  return async (payload, contexto) => {
    const datos = comoRegistro(payload);
    const chatId = comoBigInt(datos.chatId, "chatId");
    const userTelegramId = comoBigInt(datos.userTelegramId, "userTelegramId");

    const hash = await contexto.userbot.obtenerHashAvatar(userTelegramId);
    if (hash === null) {
      const vacio: ResultadoDetectarMulticuenta = {
        hash: null,
        coincidencias: [],
      };
      return vacio;
    }

    await repos.identidad.registrarAvatar({ telegramId: userTelegramId, hash });
    const coincidencias = await repos.identidad.buscarCoincidencias({
      telegramId: userTelegramId,
      hash,
    });

    contexto.logger.info(
      { chatId, userTelegramId, coincidencias: coincidencias.length },
      "identidad: comparacion de avatar completada",
    );

    const resultado: ResultadoDetectarMulticuenta = { hash, coincidencias };
    return resultado;
  };
};

export interface ResultadoRegistrarCambioAlias {
  readonly cambio: boolean;
}

/** `identidad.registrar_cambio_alias`: delega en el censo, que ya sabe si es idempotente. */
const registrarCambioAlias = (
  repos: RepositoriosDeIdentidad,
): ManejadorDeSolicitud => {
  return async (payload) => {
    const datos = comoRegistro(payload);
    const tenantId = comoTexto(datos.tenantId, "tenantId");
    const chatId = comoTexto(datos.chatId, "chatId");
    const userTelegramId = comoBigInt(datos.userTelegramId, "userTelegramId");
    const alias = comoTextoONulo(datos.alias, "alias");

    const cambio = await repos.censo.registrarAliasSiCambio({
      tenantId,
      chatId,
      userTelegramId,
      alias,
    });

    const resultado: ResultadoRegistrarCambioAlias = { cambio };
    return resultado;
  };
};

/** El catalogo del bloque, con los repositorios ya inyectados. */
export const crearManejadoresDeIdentidad = (
  repos: RepositoriosDeIdentidad,
): CatalogoDeManejadores => ({
  "identidad.detectar_multicuenta": detectarMulticuenta(repos),
  "identidad.registrar_cambio_alias": registrarCambioAlias(repos),
});

// ---------------------------------------------------------------------------
// 4. Ficha completa -- SOLO el propietario
// ---------------------------------------------------------------------------

/**
 * La ficha completa de una persona: bio, chats en comun, Premium, antiguedad
 * estimada. Esto es exactamente lo que `docs/PLAN-AYUDANTE.md` prohibe
 * exponer al staff -- bio, chats en comun y antiguedad son "de donde salio
 * el dato", no un veredicto. Hoy no la llama nadie (cablearla hacia el
 * consultor es un paso posterior), pero el nombre y este comentario dejan la
 * barrera escrita: si alguna vez hace falta una version para el staff, es
 * OTRA funcion, con OTRO nombre, que devuelve MENOS que esto, nunca esta.
 */
export const fichaParaPropietario = (
  userbot: UserbotPort,
  userTelegramId: bigint,
): Promise<FichaCompleta> => userbot.obtenerFichaCompleta(userTelegramId);
