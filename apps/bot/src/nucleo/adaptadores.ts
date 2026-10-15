import { randomUUID } from "node:crypto";
import type {
  AleatoriedadPort,
  AuditoriaPort,
  ContextoDeUpdate,
  IdempotenciaPort,
  MetricasPort,
  RelojPort,
} from "@superbot/domain";
import {
  explicacionesValidas,
  fuentesDeConfianzaValidas,
  type ReputacionDeFuente,
} from "@superbot/module-automation";

import { botMetrics } from "../metrics.js";

/**
 * Las implementaciones concretas de los puertos que define
 * `packages/domain/src/puertos.ts`.
 *
 * Aqui vive el unico sitio del bot que sabe a la vez de contratos y de
 * infraestructura. Un modulo recibe puertos; el nucleo los construye. Esa es
 * toda la frontera.
 *
 * Cada adaptador se construye con una **fabrica que recibe sus dependencias**,
 * no leyendolas de un servicio gigante. Asi se pueden probar sueltos, que es
 * justo lo que hoy no se puede hacer con `BotUpdateService` y sus 56
 * inyecciones posicionales.
 */

/** El reloj real. */
export const relojDelSistema = (): RelojPort => ({
  ahora: () => new Date(),
  ahoraMs: () => Date.now(),
});

/**
 * Un reloj congelado, para tests.
 *
 * Existe porque media docena de tests del repo ya congelan el reloj a mano
 * —los del rate limit del guard de la Mini App, por ejemplo, que sin congelarlo
 * dejan de dar 429 bajo carga—. Con el puerto, congelarlo deja de ser un truco
 * por fichero y pasa a ser parte del contrato.
 */
export const relojFijo = (instante: Date): RelojPort => ({
  ahora: () => new Date(instante),
  ahoraMs: () => instante.getTime(),
});

/** Aleatoriedad real. */
export const aleatoriedadDelSistema = (): AleatoriedadPort => ({
  uuid: () => randomUUID(),
  entero: (minimo, maximo) =>
    Math.floor(Math.random() * (maximo - minimo + 1)) + minimo,
});

/**
 * Aleatoriedad reproducible, para tests.
 *
 * OJO: esto NO sirve para claves de idempotencia. Una clave debe derivarse del
 * `updateId`, no de una secuencia — un aleatorio "reproducible" sigue dando
 * valores distintos en llamadas sucesivas, que es exactamente el fallo que
 * tenian diez sitios del servicio.
 */
export const aleatoriedadDeSecuencia = (
  valores: readonly string[],
): AleatoriedadPort => {
  let indice = 0;
  return {
    uuid: () => {
      const valor = valores[indice % valores.length] ?? "uuid-0";
      indice += 1;
      return valor;
    },
    entero: (minimo) => minimo,
  };
};

/** Metricas sobre el registro por proceso que ya existe. */
export const metricasDelProceso = (): MetricasPort => ({
  incrementar: (nombre, cuanto = 1) => botMetrics.increment(nombre, cuanto),
  observar: (nombre, valor) => botMetrics.increment(`${nombre}_sum`, valor),
});

/**
 * Idempotencia sobre `FoundationRepository.reservarEjecucionUnica`.
 *
 * Se le pasa la funcion, no el repositorio entero: el puerto necesita
 * exactamente una capacidad y darle mas seria volver a acoplar lo que se acaba
 * de separar.
 */
export const idempotenciaConRepositorio = (
  contexto: ContextoDeUpdate,
  reservar: (entrada: {
    tenantId?: string | undefined;
    namespace: string;
    key: string;
    expiraEn?: Date;
  }) => Promise<boolean>,
): IdempotenciaPort => ({
  reservar: ({ namespace, key, expiraEn }) =>
    reservar({
      tenantId: contexto.tenantId,
      namespace,
      key,
      ...(expiraEn ? { expiraEn } : {}),
    }),
});

/**
 * La salida a Telegram, ya atada al bot de ESTE update.
 *
 * Recibe el token **resuelto**, no la forma de resolverlo, y por eso el puerto
 * que devuelve no tiene forma de elegir bot. El nucleo resuelve el token dentro
 * del ambito del update (`resolveBotToken`, que se niega a caer al bot padre
 * cuando el bot gestionado no responde) y construye esto con el resultado.
 *
 * Si algun dia esta fabrica aceptara "el token o el de por defecto", se
 * recupera el fallo que hoy es imposible: un bot hijo contestando como el
 * padre, con el tenant equivocado y la autoridad de moderacion equivocada.
 */
export const telegramDelUpdate = (
  token: string,
  gateway: {
    sendMessage(entrada: {
      chatId: bigint;
      reply: unknown;
      token: string;
      messageThreadId?: number;
    }): Promise<{ ok: boolean; messageId?: number }>;
    deleteMessage(entrada: {
      chatId: bigint;
      messageId: number;
      token: string;
    }): Promise<{ ok: boolean }>;
    restrictChatMember(entrada: {
      chatId: bigint;
      userId: bigint;
      token: string;
      untilDate?: number;
    }): Promise<{ ok: boolean }>;
    banChatMember(entrada: {
      chatId: bigint;
      userId: bigint;
      token: string;
    }): Promise<{ ok: boolean }>;
  },
) => ({
  enviarMensaje: ({
    chatId,
    respuesta,
    messageThreadId,
  }: {
    chatId: bigint;
    respuesta: unknown;
    messageThreadId?: number;
  }) =>
    gateway.sendMessage({
      chatId,
      reply: respuesta,
      token,
      ...(messageThreadId === undefined ? {} : { messageThreadId }),
    }),

  borrarMensaje: ({
    chatId,
    messageId,
  }: {
    chatId: bigint;
    messageId: number;
  }) => gateway.deleteMessage({ chatId, messageId, token }),

  restringirMiembro: ({
    chatId,
    userId,
    hasta,
  }: {
    chatId: bigint;
    userId: bigint;
    hasta?: Date;
  }) =>
    gateway.restrictChatMember({
      chatId,
      userId,
      token,
      ...(hasta ? { untilDate: Math.floor(hasta.getTime() / 1000) } : {}),
    }),

  expulsarMiembro: ({ chatId, userId }: { chatId: bigint; userId: bigint }) =>
    gateway.banChatMember({ chatId, userId, token }),
});

/**
 * Las dos preguntas de autorizacion, cada una con su comprobacion real.
 *
 * Se le pasan las **dos** funciones por separado a proposito. Si el adaptador
 * recibiera una sola y respondiera lo mismo a las dos preguntas, seria una
 * escalada de privilegios: un admin nombrado con `/admin` pasa `puedeModerar`
 * —el bot lo promociona de verdad en Telegram— pero **debe fallar**
 * `puedeConfigurar`, o podria abrir los ajustes y apagar al guardia que le
 * vigila.
 */
export const permisosDelUpdate = <C, U>(
  contexto: C,
  update: U,
  esAdminDeTelegram: (contexto: C, update: U) => Promise<boolean>,
  puedeTocarConfiguracion: (contexto: C, update: U) => Promise<boolean>,
) => ({
  puedeModerar: () => esAdminDeTelegram(contexto, update),
  puedeConfigurar: () => puedeTocarConfiguracion(contexto, update),
});

/**
 * Ajustes del chat de ESTE update.
 *
 * El chat va atado igual que el tenant en la auditoria: un modulo lee y escribe
 * los ajustes del chat donde ocurrio el update, no los de cualquiera.
 */
export const ajustesDelChat = (
  contexto: ContextoDeUpdate,
  leerValor: (
    tenantId: string,
    chatId: string,
    clave: string,
  ) => Promise<unknown>,
  escribirValor: (
    tenantId: string,
    chatId: string,
    clave: string,
    valor: unknown,
  ) => Promise<void>,
) => ({
  leer: async <T>(clave: string): Promise<T | undefined> => {
    if (!contexto.chatId) return undefined;
    return (await leerValor(contexto.tenantId, contexto.chatId, clave)) as
      | T
      | undefined;
  },
  escribir: async <T>(clave: string, valor: T): Promise<void> => {
    if (!contexto.chatId) return;
    await escribirValor(contexto.tenantId, contexto.chatId, clave, valor);
  },
});

/**
 * El registro de actividad que consume `modules/community`.
 *
 * Traduce el contrato del modulo —en espanol y con solo los campos que le
 * importan— a la forma del repositorio. Esta traduccion es justo lo que permite
 * que el modulo no sepa que existe Prisma: si el dia de manana cambia la tabla,
 * cambia este adaptador y el modulo no se entera.
 */
export const registroDeActividadConRepositorio = (
  grabar: (entrada: {
    tenantId: string;
    chatId: string;
    kind: string;
    text: string;
    hasLink: boolean;
    hasMention: boolean;
    isReply: boolean;
    telegramUserId?: bigint;
    username?: string;
    repliedToUserId?: bigint;
    topic?: string;
    messageId?: bigint;
  }) => Promise<unknown>,
) => ({
  registrar: async (actividad: {
    tenantId: string;
    chatId: string;
    texto: string;
    tieneEnlace: boolean;
    tieneMencion: boolean;
    usuarioTelegramId?: bigint;
    usuario?: string;
    respondeAUsuarioId?: bigint;
    tema?: string;
    mensajeId?: bigint;
  }): Promise<void> => {
    await grabar({
      tenantId: actividad.tenantId,
      chatId: actividad.chatId,
      kind: "message",
      text: actividad.texto,
      hasLink: actividad.tieneEnlace,
      hasMention: actividad.tieneMencion,
      isReply: actividad.respondeAUsuarioId !== undefined,
      ...(actividad.usuarioTelegramId !== undefined
        ? { telegramUserId: actividad.usuarioTelegramId }
        : {}),
      ...(actividad.usuario !== undefined
        ? { username: actividad.usuario }
        : {}),
      ...(actividad.respondeAUsuarioId !== undefined
        ? { repliedToUserId: actividad.respondeAUsuarioId }
        : {}),
      ...(actividad.tema !== undefined ? { topic: actividad.tema } : {}),
      ...(actividad.mensajeId !== undefined
        ? { messageId: actividad.mensajeId }
        : {}),
    });
  },
});

/**
 * La fila que espera el repositorio de archivo.
 *
 * Se declara aqui, con nombres en ingles, porque es la forma de la capa de
 * datos: la traduccion desde el contrato del modulo —que va en espanol y solo
 * con lo que le importa— es precisamente el trabajo de este adaptador.
 */
interface EntradaDeArchivo {
  readonly tenantId: string;
  readonly chatId?: string;
  readonly telegramChatId: bigint;
  readonly telegramUserId: bigint;
  readonly messageId: number;
  readonly kind: string;
  readonly sentAt: Date;
  readonly threadId?: number;
  readonly username?: string;
  readonly displayName?: string;
  readonly text?: string;
  readonly replyToMessageId?: number;
  readonly replyToUserId?: bigint;
  readonly mediaFileId?: string;
  readonly mediaUniqueId?: string;
  readonly mediaMimeType?: string;
  readonly mediaSizeBytes?: number;
}

/**
 * El archivo de mensajes que consume `modules/community`.
 *
 * Dos capacidades, no el repositorio entero: dar de alta y anotar una edicion.
 */
export const archivoDeMensajesConRepositorio = (
  grabar: (entrada: EntradaDeArchivo) => Promise<unknown>,
  grabarEdicion: (entrada: {
    telegramChatId: bigint;
    messageId: number;
    // Requerido y nullable, no opcional: asi lo declara el repositorio, y con
    // `exactOptionalPropertyTypes` no son lo mismo.
    text: string | undefined;
    editedAt: Date;
  }) => Promise<unknown>,
) => ({
  guardar: async (mensaje: {
    tenantId: string;
    chatId?: string;
    telegramChatId: bigint;
    telegramUserId: bigint;
    mensajeId: number;
    tipo: string;
    enviadoEn: Date;
    hiloId?: number;
    usuario?: string;
    nombreVisible?: string;
    texto?: string;
    respondeAMensajeId?: number;
    respondeAUsuarioId?: bigint;
    adjunto?: {
      ficheroId: string;
      ficheroUnicoId: string;
      mimeType?: string;
      tamanoBytes?: number;
    };
  }): Promise<void> => {
    const entrada: EntradaDeArchivo = {
      tenantId: mensaje.tenantId,
      ...(mensaje.chatId !== undefined ? { chatId: mensaje.chatId } : {}),
      telegramChatId: mensaje.telegramChatId,
      telegramUserId: mensaje.telegramUserId,
      messageId: mensaje.mensajeId,
      kind: mensaje.tipo,
      sentAt: mensaje.enviadoEn,
      ...(mensaje.hiloId !== undefined ? { threadId: mensaje.hiloId } : {}),
      ...(mensaje.usuario !== undefined ? { username: mensaje.usuario } : {}),
      ...(mensaje.nombreVisible !== undefined
        ? { displayName: mensaje.nombreVisible }
        : {}),
      ...(mensaje.texto !== undefined ? { text: mensaje.texto } : {}),
      ...(mensaje.respondeAMensajeId !== undefined
        ? { replyToMessageId: mensaje.respondeAMensajeId }
        : {}),
      ...(mensaje.respondeAUsuarioId !== undefined
        ? { replyToUserId: mensaje.respondeAUsuarioId }
        : {}),
      ...(mensaje.adjunto
        ? {
            mediaFileId: mensaje.adjunto.ficheroId,
            mediaUniqueId: mensaje.adjunto.ficheroUnicoId,
            ...(mensaje.adjunto.mimeType !== undefined
              ? { mediaMimeType: mensaje.adjunto.mimeType }
              : {}),
            ...(mensaje.adjunto.tamanoBytes !== undefined
              ? { mediaSizeBytes: mensaje.adjunto.tamanoBytes }
              : {}),
          }
        : {}),
    };
    await grabar(entrada);
  },

  guardarEdicion: async (edicion: {
    telegramChatId: bigint;
    mensajeId: number;
    texto?: string;
    editadoEn: Date;
  }): Promise<void> => {
    await grabarEdicion({
      telegramChatId: edicion.telegramChatId,
      messageId: edicion.mensajeId,
      // Se pasa siempre, aunque sea `undefined`: el repositorio lo declara
      // requerido y nullable. Omitirlo no compila.
      text: edicion.texto,
      editedAt: edicion.editadoEn,
    });
  },
});

/**
 * Auditoria atada al tenant y al actor de ESTE update.
 *
 * El modulo dice que paso; no elige de parte de quien. Igual que con el token
 * de Telegram, la atadura la hace el nucleo para que no se pueda falsear desde
 * dentro de un modulo.
 */
export const auditoriaDelUpdate = (
  contexto: ContextoDeUpdate,
  registrar: (entrada: {
    tenantId: string;
    actorType: string;
    actorId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    payload?: unknown;
  }) => Promise<void>,
): AuditoriaPort => ({
  registrar: ({ accion, recurso, recursoId, datos }) =>
    registrar({
      tenantId: contexto.tenantId,
      actorType: contexto.userId ? "user" : "system",
      ...(contexto.userId ? { actorId: contexto.userId } : {}),
      action: accion,
      resourceType: recurso,
      ...(recursoId ? { resourceId: recursoId } : {}),
      ...(datos ? { payload: datos } : {}),
    }),
});

/**
 * El puerto que `modules/security` necesita para revisar una edicion: dado un
 * id de mensaje, el original tal y como se registro.
 *
 * Traduce la fila del registro de actividad a la forma del modulo. Esa
 * traduccion es lo que permite que el modulo no sepa que existe Prisma ni como
 * se llaman las columnas.
 */
export const originalDeMensajeConRepositorio = (
  buscar: (mensajeId: bigint) => Promise<
    | {
        text?: string | undefined;
        hasLink?: boolean | undefined;
        hasMention?: boolean | undefined;
        createdAt: Date;
      }
    | undefined
  >,
) => ({
  buscar: async (mensajeId: bigint) => {
    const fila = await buscar(mensajeId);
    // Sin texto no hay nada que comparar: cuenta como "no esta".
    if (fila === undefined || fila.text === undefined || fila.text === null) {
      return null;
    }
    return {
      texto: fila.text,
      teniaEnlace: fila.hasLink ?? false,
      teniaMencion: fila.hasMention ?? false,
      publicadoEn: fila.createdAt,
    };
  },
});

/**
 * El mapa de fuentes de confianza de un chat, para `modules/automation`.
 *
 * La fabrica recibe el par leer/escribir ya atado a su tenant y chat: el
 * modulo no sabe que existe una tabla de ajustes ni bajo que clave vive esto.
 *
 * La validacion de la forma la hace el MODULO (`fuentesDeConfianzaValidas`), no
 * este adaptador. Es donde tiene que estar: quien decide que forma vale es
 * quien la consume, y asi la regla se prueba sin base de datos.
 */
export const fuentesDeConfianzaConAjustes = (
  leer: () => Promise<unknown>,
  escribir: (valor: unknown) => Promise<void>,
) => ({
  leer: async () => fuentesDeConfianzaValidas(await leer()),
  guardar: async (fuentes: Record<string, ReputacionDeFuente>) => {
    await escribir(fuentes);
  },
});

/** Las explicaciones oficiales de las reglas de un chat. Mismo criterio. */
export const explicacionesDeReglaConAjustes = (
  leer: () => Promise<unknown>,
  escribir: (valor: unknown) => Promise<void>,
) => ({
  leer: async () => explicacionesValidas(await leer()),
  guardar: async (explicaciones: Record<string, string>) => {
    await escribir(explicaciones);
  },
});
