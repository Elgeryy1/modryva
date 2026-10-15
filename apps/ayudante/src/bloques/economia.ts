import type { AyudanteAvisoPrivadoRepository } from "@superbot/data";
import { enviarAvisoPrivado, type ResultadoAvisoPrivado } from "../avisos.js";
import type {
  CatalogoDeManejadores,
  ManejadorDeSolicitud,
} from "../despachador.js";

/**
 * Bloque F -- solo la parte de economia y juego que necesita el userbot:
 * publicar la semilla del casino, avisar a la victima de un robo aunque
 * tenga el bot bloqueado, y un reto privado. Nada de mercado, subastas ni
 * logica de casino en si -- eso vive donde ya vive, sin MTProto de por
 * medio.
 */

// ---------------------------------------------------------------------------
// Lectura de payload -- la cola guarda JSON (`Json` en Prisma), asi que todo
// lo que llega a un manejador es `unknown` y hay que validarlo a mano antes
// de tocarlo. Mismo patron que `bloques/identidad.ts` y `bloques/censo.ts`;
// se duplica aqui a proposito, porque en este pase paralelo un bloque no
// importa codigo de otro.
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

/** Acepta `number` o texto numerico, igual que `comoBigInt` -- `cantidad` puede llegar redondeada o no segun quien encole. */
const comoNumero = (valor: unknown, campo: string): number => {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string" && valor.trim().length > 0) {
    const convertido = Number(valor);
    if (Number.isFinite(convertido)) return convertido;
  }
  throw new Error(`payload invalido: "${campo}" no es un numero valido`);
};

/** No se exige un formato concreto, solo que `Date.parse` la entienda -- es lo minimo para no publicar una hora rota en un mensaje que lee gente. */
const comoFechaIso = (valor: unknown, campo: string): string => {
  const texto = comoTexto(valor, campo);
  if (Number.isNaN(Date.parse(texto))) {
    throw new Error(`payload invalido: "${campo}" no es una fecha valida`);
  }
  return texto;
};

// ---------------------------------------------------------------------------
// Textos -- puros, sin tocar el reloj ni la red, para poder probarlos sin
// FakeUserbot de por medio.
// ---------------------------------------------------------------------------

export const componerTextoSemillaCasino = (input: {
  readonly serverSeedHash: string;
  readonly hora: string;
}): string =>
  `Semilla del casino publicada.\nHash: ${input.serverSeedHash}\nHora: ${input.hora}`;

export const componerTextoAvisoRobo = (input: {
  readonly ladronTelegramId: bigint;
  readonly cantidad: number;
}): string =>
  `Te han robado ${input.cantidad} monedas. Autor: ${input.ladronTelegramId}.`;

export const componerTextoRetoPrivado = (input: {
  readonly retadorTelegramId: bigint;
  readonly juego: string;
}): string =>
  `${input.retadorTelegramId} te ha retado a ${input.juego}. Responde en el grupo si aceptas.`;

// ---------------------------------------------------------------------------
// 1. economia.publicar_semilla_casino
// ---------------------------------------------------------------------------

export interface ResultadoPublicarSemillaCasino {
  readonly texto: string;
  readonly ok: boolean;
}

/**
 * `economia.publicar_semilla_casino`: compone el texto con el hash y la hora
 * en claro y lo publica en el canal de auditoria con `publicarEnCanal`.
 *
 * Publicar, no enviar un privado: un canal no es un destinatario. Y si la
 * publicacion falla, este manejador LANZA en vez de devolver `ok: false` --
 * la razon de ser de la semilla es que cualquiera pueda comprobar el sorteo,
 * asi que una semilla que no llego a publicarse tiene que reintentarse, no
 * apuntarse en un log y darse por hecha.
 *
 * No pasa por `AyudanteAvisoPrivadoRepository`: esa tabla es seguimiento de
 * avisos a UNA persona, y esto es una publicacion.
 */
const publicarSemillaCasino: ManejadorDeSolicitud = async (
  payload,
  contexto,
) => {
  const datos = comoRegistro(payload);
  const canalId = comoBigInt(datos.canalId, "canalId");
  const serverSeedHash = comoTexto(datos.serverSeedHash, "serverSeedHash");
  const hora = comoFechaIso(datos.hora, "hora");

  const texto = componerTextoSemillaCasino({ serverSeedHash, hora });
  const { ok } = await contexto.userbot.publicarEnCanal({ canalId, texto });
  if (!ok) {
    throw new Error(
      `no se pudo publicar la semilla del casino en el canal ${canalId}`,
    );
  }

  contexto.logger.info(
    { canalId: canalId.toString() },
    "economia: semilla del casino publicada",
  );

  const salida: ResultadoPublicarSemillaCasino = { texto, ok };
  return salida;
};

// ---------------------------------------------------------------------------
// 2 y 3. Los manejadores que si usan el repositorio de avisos
// ---------------------------------------------------------------------------

export interface RepositoriosDeEconomia {
  readonly avisos: AyudanteAvisoPrivadoRepository;
}

export interface ResultadoAvisarRobo {
  readonly resultado: ResultadoAvisoPrivado;
}

const TIPO_AVISO_ROBO = "economia.aviso_robo";

/**
 * `economia.avisar_robo`: avisa a la victima aunque tenga el bot bloqueado.
 * Por eso pasa por `enviarAvisoPrivado` y no por un mensaje normal de
 * Telegram -- el aviso pasa por el userbot precisamente porque el camino del
 * bot ya fallo o podria fallar.
 */
const avisarRobo = (repos: RepositoriosDeEconomia): ManejadorDeSolicitud => {
  return async (payload, contexto) => {
    const datos = comoRegistro(payload);
    const tenantId = comoTexto(datos.tenantId, "tenantId");
    const victimaTelegramId = comoBigInt(
      datos.victimaTelegramId,
      "victimaTelegramId",
    );
    const ladronTelegramId = comoBigInt(
      datos.ladronTelegramId,
      "ladronTelegramId",
    );
    const cantidad = comoNumero(datos.cantidad, "cantidad");

    const texto = componerTextoAvisoRobo({ ladronTelegramId, cantidad });
    const resultado = await enviarAvisoPrivado(repos.avisos, contexto.userbot, {
      tenantId,
      destinatarioTelegramId: victimaTelegramId,
      tipo: TIPO_AVISO_ROBO,
      texto,
    });

    contexto.logger.info(
      {
        tenantId,
        victimaTelegramId: victimaTelegramId.toString(),
        yaAvisado: resultado.yaAvisado,
        estado: resultado.envio?.estado ?? null,
      },
      "economia: aviso de robo enviado",
    );

    const salida: ResultadoAvisarRobo = { resultado };
    return salida;
  };
};

export interface ResultadoRetoPrivado {
  readonly resultado: ResultadoAvisoPrivado;
}

const TIPO_RETO_PRIVADO = "economia.reto_privado";

/**
 * `economia.reto_privado`: invita por privado a quien recibe el reto.
 *
 * ADVERTENCIA: el enunciado de este bloque no listaba `tenantId` en el
 * payload, pero `AyudanteAvisoPrivadoRepository.registrarPendiente` lo exige
 * -- como todo lo demas en este repo, el aviso es por tenant. Se añade aqui
 * como campo obligatorio, igual que en `avisar_robo`; quien encole esta
 * solicitud tiene que incluirlo.
 */
const retoPrivado = (repos: RepositoriosDeEconomia): ManejadorDeSolicitud => {
  return async (payload, contexto) => {
    const datos = comoRegistro(payload);
    const tenantId = comoTexto(datos.tenantId, "tenantId");
    const retadorTelegramId = comoBigInt(
      datos.retadorTelegramId,
      "retadorTelegramId",
    );
    const retadoTelegramId = comoBigInt(
      datos.retadoTelegramId,
      "retadoTelegramId",
    );
    const juego = comoTexto(datos.juego, "juego");

    const texto = componerTextoRetoPrivado({ retadorTelegramId, juego });
    const resultado = await enviarAvisoPrivado(repos.avisos, contexto.userbot, {
      tenantId,
      destinatarioTelegramId: retadoTelegramId,
      tipo: TIPO_RETO_PRIVADO,
      texto,
    });

    contexto.logger.info(
      {
        tenantId,
        retadorTelegramId: retadorTelegramId.toString(),
        retadoTelegramId: retadoTelegramId.toString(),
        yaAvisado: resultado.yaAvisado,
        estado: resultado.envio?.estado ?? null,
      },
      "economia: reto privado enviado",
    );

    const salida: ResultadoRetoPrivado = { resultado };
    return salida;
  };
};

/** El catalogo del bloque, con el repositorio ya inyectado. */
export const manejadoresDeEconomia = (
  repos: RepositoriosDeEconomia,
): CatalogoDeManejadores => ({
  "economia.publicar_semilla_casino": publicarSemillaCasino,
  "economia.avisar_robo": avisarRobo(repos),
  "economia.reto_privado": retoPrivado(repos),
});
