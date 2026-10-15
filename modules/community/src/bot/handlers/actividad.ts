import type { ActividadDeChat, RegistroDeActividadPort } from "../puertos.js";

/**
 * Lo que el handler necesita saber del update, ya normalizado por el nucleo.
 *
 * No es el `TelegramUpdateEnvelope` entero a proposito: cuanto menos sepa el
 * modulo de la forma de un update de Telegram, menos se rompe cuando esa forma
 * cambie.
 */
export interface UpdateParaActividad {
  readonly tipo: string;
  readonly esComando: boolean;
  readonly texto: string | undefined;
  readonly tenantId: string;
  readonly chatId: string | undefined;
  readonly tieneEnlace: boolean;
  readonly tieneMencion: boolean;
  readonly usuarioTelegramId: bigint | undefined;
  readonly usuario: string | undefined;
  readonly respondeAUsuarioId: bigint | undefined;
  readonly tema: string | undefined;
  readonly mensajeId: bigint | undefined;
}

/**
 * Decide si un update cuenta como actividad registrable.
 *
 * Pura y exportada para poder probarla sin puerto ninguno. Se salta los
 * comandos, lo que no sea un mensaje y lo que no traiga texto — que es
 * exactamente lo que hacia el handler dentro del servicio, y no cambia: esto es
 * una extraccion, no un cambio de producto.
 *
 * Ojo con confundirlo con el registro completo (`message-log.archive`), que SI
 * guarda comandos y mensajes sin texto y no caduca. Son dos cosas distintas a
 * proposito.
 */
export const cuentaComoActividad = (update: UpdateParaActividad): boolean =>
  update.tipo === "message" &&
  !update.esComando &&
  Boolean(update.texto) &&
  Boolean(update.chatId);

/** Traduce un update ya normalizado a lo que guarda el registro. */
export const actividadDesdeUpdate = (
  update: UpdateParaActividad,
): ActividadDeChat | null => {
  if (!cuentaComoActividad(update) || !update.chatId || !update.texto) {
    return null;
  }
  return {
    tenantId: update.tenantId,
    chatId: update.chatId,
    texto: update.texto,
    tieneEnlace: update.tieneEnlace,
    tieneMencion: update.tieneMencion,
    ...(update.usuarioTelegramId !== undefined
      ? { usuarioTelegramId: update.usuarioTelegramId }
      : {}),
    ...(update.usuario !== undefined ? { usuario: update.usuario } : {}),
    ...(update.respondeAUsuarioId !== undefined
      ? { respondeAUsuarioId: update.respondeAUsuarioId }
      : {}),
    ...(update.tema !== undefined ? { tema: update.tema } : {}),
    ...(update.mensajeId !== undefined ? { mensajeId: update.mensajeId } : {}),
  };
};

/**
 * El handler `chat-activity.logger`, ya fuera del servicio.
 *
 * Devuelve siempre `null`: registra y deja pasar, nunca corta la cadena ni
 * responde a nadie. Por eso esta declarado como tolerante en el nucleo — si
 * falla, la persona que escribio no se queda sin respuesta.
 *
 * El `catch` vacio se mantiene igual que estaba: el registro de actividad es
 * best-effort y no bloquea el pipeline. Con el aislamiento por handler del
 * nucleo seria redundante, pero quitarlo cambiaria el comportamiento —de
 * "sigue en silencio" a "se registra un warn"— y esto es una extraccion.
 */
export const registrarActividadDeChat = async (
  update: UpdateParaActividad,
  registro: RegistroDeActividadPort,
): Promise<null> => {
  const actividad = actividadDesdeUpdate(update);
  if (!actividad) return null;

  try {
    await registro.registrar(actividad);
  } catch {
    // No fatal: el registro de actividad nunca bloquea el pipeline.
  }
  return null;
};
