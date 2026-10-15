/**
 * `message-log.archive`: el registro completo de lo que ve el bot.
 *
 * A diferencia de la actividad (`chat-activity.logger`), este **no se salta
 * nada**: guarda comandos, mensajes solo con foto y ediciones. Y no caduca —
 * es una decision explicita del propietario (2026-08-09), no un olvido. Lo
 * unico que no guarda son los eventos de servicio (alguien entro, alguien
 * salio, se fijo un mensaje), que ya tienen su sitio.
 */

/** Un adjunto, con lo justo que el archivo necesita saber de el. */
export interface AdjuntoArchivable {
  readonly tipo: string;
  readonly ficheroId: string;
  readonly ficheroUnicoId: string;
  readonly mimeType?: string;
  readonly tamanoBytes?: number;
}

/** Un mensaje listo para archivar. */
export interface MensajeArchivable {
  readonly tenantId: string;
  readonly chatId?: string;
  readonly telegramChatId: bigint;
  readonly telegramUserId: bigint;
  readonly mensajeId: number;
  readonly tipo: string;
  readonly enviadoEn: Date;
  readonly hiloId?: number;
  readonly usuario?: string;
  readonly nombreVisible?: string;
  readonly texto?: string;
  readonly respondeAMensajeId?: number;
  readonly respondeAUsuarioId?: bigint;
  readonly adjunto?: AdjuntoArchivable;
}

/** Una edicion de un mensaje ya archivado. */
export interface EdicionArchivable {
  readonly telegramChatId: bigint;
  readonly mensajeId: number;
  readonly texto?: string;
  readonly editadoEn: Date;
}

/** Donde se guarda el archivo. */
export interface ArchivoDeMensajesPort {
  guardar(mensaje: MensajeArchivable): Promise<void>;
  guardarEdicion(edicion: EdicionArchivable): Promise<void>;
}

/** Lo que el handler necesita del update, ya normalizado por el nucleo. */
export interface UpdateParaArchivo {
  readonly tipo: string;
  readonly tenantId: string;
  readonly chatId: string | undefined;
  readonly telegramChatId: bigint | undefined;
  readonly telegramUserId: bigint | undefined;
  readonly mensajeId: number | undefined;
  readonly texto: string | undefined;
  readonly recibidoEn: Date;
  readonly hiloId: number | undefined;
  readonly usuario: string | undefined;
  readonly nombreVisible: string | undefined;
  readonly respondeAMensajeId: number | undefined;
  readonly respondeAUsuarioId: bigint | undefined;
  readonly adjunto: AdjuntoArchivable | undefined;
}

/**
 * Que hacer con este update: archivarlo, anotar una edicion, o nada.
 *
 * Pura y exportada. Concentra las tres condiciones que antes estaban repartidas
 * por el handler, que es donde es facil que se cuele un caso.
 */
export const queHacerConElUpdate = (
  update: UpdateParaArchivo,
): "archivar" | "anotar-edicion" | "ignorar" => {
  if (update.tipo === "edited_message") {
    return update.telegramChatId === undefined || update.mensajeId === undefined
      ? "ignorar"
      : "anotar-edicion";
  }

  if (
    update.tipo !== "message" ||
    update.telegramChatId === undefined ||
    update.telegramUserId === undefined ||
    update.mensajeId === undefined
  ) {
    return "ignorar";
  }

  // Sin texto, sin pie y sin adjunto no aporta nada: son eventos de servicio.
  return update.texto || update.adjunto ? "archivar" : "ignorar";
};

/** Traduce un update ya normalizado a lo que guarda el archivo. */
export const mensajeDesdeUpdate = (
  update: UpdateParaArchivo,
): MensajeArchivable | null => {
  if (
    queHacerConElUpdate(update) !== "archivar" ||
    update.telegramChatId === undefined ||
    update.telegramUserId === undefined ||
    update.mensajeId === undefined
  ) {
    return null;
  }

  return {
    tenantId: update.tenantId,
    ...(update.chatId !== undefined ? { chatId: update.chatId } : {}),
    telegramChatId: update.telegramChatId,
    telegramUserId: update.telegramUserId,
    mensajeId: update.mensajeId,
    tipo: update.adjunto?.tipo ?? "text",
    enviadoEn: update.recibidoEn,
    ...(update.hiloId !== undefined ? { hiloId: update.hiloId } : {}),
    ...(update.usuario !== undefined ? { usuario: update.usuario } : {}),
    ...(update.nombreVisible !== undefined
      ? { nombreVisible: update.nombreVisible }
      : {}),
    ...(update.texto !== undefined ? { texto: update.texto } : {}),
    ...(update.respondeAMensajeId !== undefined
      ? { respondeAMensajeId: update.respondeAMensajeId }
      : {}),
    ...(update.respondeAUsuarioId !== undefined
      ? { respondeAUsuarioId: update.respondeAUsuarioId }
      : {}),
    ...(update.adjunto ? { adjunto: update.adjunto } : {}),
  };
};

/**
 * El handler, ya fuera del servicio.
 *
 * Devuelve siempre `null`: archiva y deja pasar. Los `catch` se mantienen tal
 * como estaban —archivar nunca puede impedir que el bot modere— aunque el
 * nucleo ya aisle este handler: quitarlos cambiaria el comportamiento de
 * "sigue en silencio" a "deja un warn", y esto es una extraccion.
 */
export const archivarMensaje = async (
  update: UpdateParaArchivo,
  archivo: ArchivoDeMensajesPort,
): Promise<null> => {
  const decision = queHacerConElUpdate(update);

  if (decision === "anotar-edicion") {
    if (update.telegramChatId === undefined || update.mensajeId === undefined) {
      return null;
    }
    try {
      await archivo.guardarEdicion({
        telegramChatId: update.telegramChatId,
        mensajeId: update.mensajeId,
        ...(update.texto !== undefined ? { texto: update.texto } : {}),
        editadoEn: update.recibidoEn,
      });
    } catch {
      // Best-effort, igual que el alta.
    }
    return null;
  }

  const mensaje = mensajeDesdeUpdate(update);
  if (!mensaje) return null;

  try {
    await archivo.guardar(mensaje);
  } catch {
    // Best-effort: archivar nunca puede impedir que el bot modere.
  }
  return null;
};
