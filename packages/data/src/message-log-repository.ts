import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * El registro completo de mensajes.
 *
 * Guarda todo lo que ve el bot, sin caducidad, por decision explicita del
 * propietario. Lo lee el bot consultor; nada del pipeline de moderacion lo
 * consulta, y es a proposito: las heuristicas siguen contando sobre
 * `chat_activity_events`, que caduca a los 90 dias y que esto NO sustituye.
 */

export interface MessageLogEntry {
  readonly tenantId: string;
  readonly chatId?: string | undefined;
  readonly telegramChatId: bigint;
  readonly telegramUserId: bigint;
  readonly messageId: number;
  readonly threadId?: number | undefined;
  readonly username?: string | undefined;
  readonly displayName?: string | undefined;
  readonly kind: string;
  readonly text?: string | undefined;
  readonly replyToMessageId?: number | undefined;
  readonly replyToUserId?: bigint | undefined;
  readonly mediaFileId?: string | undefined;
  readonly mediaUniqueId?: string | undefined;
  readonly mediaMimeType?: string | undefined;
  readonly mediaSizeBytes?: number | undefined;
  readonly sentAt: Date;
}

export interface MessageLogRecord {
  readonly id: string;
  readonly telegramChatId: bigint;
  readonly telegramUserId: bigint;
  readonly messageId: number;
  readonly username: string | null;
  readonly kind: string;
  readonly text: string | null;
  readonly mediaFileId: string | null;
  readonly mediaMimeType: string | null;
  readonly objectStorageKey: string | null;
  readonly editedAt: Date | null;
  readonly sentAt: Date;
}

/** Un fichero pendiente de bajar, tal y como lo pide el job del worker. */
export interface PendingMedia {
  readonly id: string;
  readonly tenantId: string;
  /** De quien es. Lo necesita el job para archivar en su carpeta. */
  readonly telegramUserId: bigint;
  readonly mediaFileId: string;
  readonly mediaMimeType: string | null;
  readonly attempts: number;
}

export interface MessageLogRepository {
  /** Guarda un mensaje. Repetir el mismo (chat, messageId) no duplica. */
  record(entry: MessageLogEntry): Promise<void>;
  /** Actualiza el texto de un mensaje editado, conservando la fila original. */
  recordEdit(input: {
    readonly telegramChatId: bigint;
    readonly messageId: number;
    readonly text: string | undefined;
    readonly editedAt: Date;
  }): Promise<void>;
  listByUser(
    telegramUserId: bigint,
    limit: number,
  ): Promise<MessageLogRecord[]>;
  countByUser(telegramUserId: bigint): Promise<number>;
  /** Busca texto dentro de los mensajes de una persona. */
  searchByUser(
    telegramUserId: bigint,
    texto: string,
    limit: number,
  ): Promise<MessageLogRecord[]>;
  /** Ficheros con file_id y sin bytes todavia. La cola del job de descarga. */
  listPendingMedia(limit: number, maxAttempts: number): Promise<PendingMedia[]>;
  markMediaStored(id: string, objectStorageKey: string): Promise<void>;
  markMediaFailed(id: string, error: string): Promise<void>;
  /**
   * Borra todo lo de una persona y devuelve las claves de almacen que quedaron
   * huerfanas, para que quien llame borre tambien los ficheros.
   *
   * Devolverlas en vez de borrarlas aqui es deliberado: este paquete no sabe
   * nada de object storage, y darle esa dependencia por una sola funcion habria
   * atado la capa de datos al almacen de ficheros para siempre.
   */
  purgeUser(telegramUserId: bigint): Promise<string[]>;
}

export class PrismaMessageLogRepository implements MessageLogRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async record(entry: MessageLogEntry): Promise<void> {
    await this.client.messageLog.upsert({
      where: {
        telegramChatId_messageId: {
          telegramChatId: entry.telegramChatId,
          messageId: entry.messageId,
        },
      },
      // Ya estaba: no se toca. Un update repetido no puede reescribir lo que
      // se guardo la primera vez, que es la version que la gente vio.
      update: {},
      create: {
        tenantId: entry.tenantId,
        chatId: entry.chatId ?? null,
        telegramChatId: entry.telegramChatId,
        telegramUserId: entry.telegramUserId,
        messageId: entry.messageId,
        threadId: entry.threadId ?? null,
        username: entry.username ?? null,
        displayName: entry.displayName ?? null,
        kind: entry.kind,
        text: entry.text ?? null,
        replyToMessageId: entry.replyToMessageId ?? null,
        replyToUserId: entry.replyToUserId ?? null,
        mediaFileId: entry.mediaFileId ?? null,
        mediaUniqueId: entry.mediaUniqueId ?? null,
        mediaMimeType: entry.mediaMimeType ?? null,
        mediaSizeBytes: entry.mediaSizeBytes ?? null,
        sentAt: entry.sentAt,
      },
    });
  }

  async recordEdit(input: {
    readonly telegramChatId: bigint;
    readonly messageId: number;
    readonly text: string | undefined;
    readonly editedAt: Date;
  }): Promise<void> {
    await this.client.messageLog.updateMany({
      where: {
        telegramChatId: input.telegramChatId,
        messageId: input.messageId,
      },
      data: { text: input.text ?? null, editedAt: input.editedAt },
    });
  }

  async listByUser(
    telegramUserId: bigint,
    limit: number,
  ): Promise<MessageLogRecord[]> {
    return this.client.messageLog.findMany({
      where: { telegramUserId },
      orderBy: { sentAt: "desc" },
      take: limit,
      select: SELECCION,
    });
  }

  async countByUser(telegramUserId: bigint): Promise<number> {
    return this.client.messageLog.count({ where: { telegramUserId } });
  }

  async searchByUser(
    telegramUserId: bigint,
    texto: string,
    limit: number,
  ): Promise<MessageLogRecord[]> {
    return this.client.messageLog.findMany({
      where: {
        telegramUserId,
        text: { contains: texto, mode: "insensitive" },
      },
      orderBy: { sentAt: "desc" },
      take: limit,
      select: SELECCION,
    });
  }

  async listPendingMedia(
    limit: number,
    maxAttempts: number,
  ): Promise<PendingMedia[]> {
    const filas = await this.client.messageLog.findMany({
      where: {
        mediaFileId: { not: null },
        objectStorageKey: null,
        mediaAttempts: { lt: maxAttempts },
      },
      // Los mas nuevos primero: un file_id de Telegram no caduca, pero el
      // fichero de una conversacion de esta manana es el que alguien va a pedir
      // hoy. Un atasco largo no debe dejar lo reciente al final de la cola.
      orderBy: { sentAt: "desc" },
      take: limit,
      select: {
        id: true,
        tenantId: true,
        telegramUserId: true,
        mediaFileId: true,
        mediaMimeType: true,
        mediaAttempts: true,
      },
    });
    return filas.flatMap((fila) =>
      fila.mediaFileId
        ? [
            {
              id: fila.id,
              tenantId: fila.tenantId,
              telegramUserId: fila.telegramUserId,
              mediaFileId: fila.mediaFileId,
              mediaMimeType: fila.mediaMimeType,
              attempts: fila.mediaAttempts,
            },
          ]
        : [],
    );
  }

  async markMediaStored(id: string, objectStorageKey: string): Promise<void> {
    await this.client.messageLog.update({
      where: { id },
      data: { objectStorageKey, mediaError: null },
    });
  }

  async markMediaFailed(id: string, error: string): Promise<void> {
    await this.client.messageLog.update({
      where: { id },
      data: {
        mediaAttempts: { increment: 1 },
        // Recortado: un error de Telegram puede venir con un cuerpo largo y
        // esta columna se lee de un vistazo, no se analiza.
        mediaError: error.slice(0, 300),
      },
    });
  }

  async purgeUser(telegramUserId: bigint): Promise<string[]> {
    const conFichero = await this.client.messageLog.findMany({
      where: { telegramUserId, objectStorageKey: { not: null } },
      select: { objectStorageKey: true },
    });
    await this.client.messageLog.deleteMany({ where: { telegramUserId } });
    return conFichero.flatMap((fila) =>
      fila.objectStorageKey ? [fila.objectStorageKey] : [],
    );
  }
}

const SELECCION = {
  id: true,
  telegramChatId: true,
  telegramUserId: true,
  messageId: true,
  username: true,
  kind: true,
  text: true,
  mediaFileId: true,
  mediaMimeType: true,
  objectStorageKey: true,
  editedAt: true,
  sentAt: true,
} as const;

/**
 * Version en memoria, para tests y para que el servicio del bot pueda
 * construirse sin base de datos.
 *
 * Guarda de verdad en vez de tragarse las llamadas: un doble mudo aqui habria
 * dejado pasar por buenos los tests que comprueban que un mensaje se archiva.
 */
export class InMemoryMessageLogRepository implements MessageLogRepository {
  readonly filas: (MessageLogEntry & {
    id: string;
    objectStorageKey: string | null;
    editedAt: Date | null;
    attempts: number;
  })[] = [];
  private seq = 0;

  async record(entry: MessageLogEntry): Promise<void> {
    const yaEsta = this.filas.some(
      (fila) =>
        fila.telegramChatId === entry.telegramChatId &&
        fila.messageId === entry.messageId,
    );
    if (yaEsta) return;
    this.seq += 1;
    this.filas.push({
      ...entry,
      id: `ml_${this.seq}`,
      objectStorageKey: null,
      editedAt: null,
      attempts: 0,
    });
  }

  async recordEdit(input: {
    readonly telegramChatId: bigint;
    readonly messageId: number;
    readonly text: string | undefined;
    readonly editedAt: Date;
  }): Promise<void> {
    for (const fila of this.filas) {
      if (
        fila.telegramChatId === input.telegramChatId &&
        fila.messageId === input.messageId
      ) {
        Object.assign(fila, { text: input.text, editedAt: input.editedAt });
      }
    }
  }

  private comoRegistro(fila: (typeof this.filas)[number]): MessageLogRecord {
    return {
      id: fila.id,
      telegramChatId: fila.telegramChatId,
      telegramUserId: fila.telegramUserId,
      messageId: fila.messageId,
      username: fila.username ?? null,
      kind: fila.kind,
      text: fila.text ?? null,
      mediaFileId: fila.mediaFileId ?? null,
      mediaMimeType: fila.mediaMimeType ?? null,
      objectStorageKey: fila.objectStorageKey,
      editedAt: fila.editedAt,
      sentAt: fila.sentAt,
    };
  }

  async listByUser(
    telegramUserId: bigint,
    limit: number,
  ): Promise<MessageLogRecord[]> {
    return this.filas
      .filter((fila) => fila.telegramUserId === telegramUserId)
      .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
      .slice(0, limit)
      .map((fila) => this.comoRegistro(fila));
  }

  async countByUser(telegramUserId: bigint): Promise<number> {
    return this.filas.filter((fila) => fila.telegramUserId === telegramUserId)
      .length;
  }

  async searchByUser(
    telegramUserId: bigint,
    texto: string,
    limit: number,
  ): Promise<MessageLogRecord[]> {
    const aguja = texto.toLowerCase();
    return this.filas
      .filter(
        (fila) =>
          fila.telegramUserId === telegramUserId &&
          (fila.text ?? "").toLowerCase().includes(aguja),
      )
      .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
      .slice(0, limit)
      .map((fila) => this.comoRegistro(fila));
  }

  async listPendingMedia(
    limit: number,
    maxAttempts: number,
  ): Promise<PendingMedia[]> {
    return this.filas
      .filter(
        (fila) =>
          fila.mediaFileId !== undefined &&
          fila.objectStorageKey === null &&
          fila.attempts < maxAttempts,
      )
      .slice(0, limit)
      .map((fila) => ({
        id: fila.id,
        tenantId: fila.tenantId,
        telegramUserId: fila.telegramUserId,
        mediaFileId: fila.mediaFileId ?? "",
        mediaMimeType: fila.mediaMimeType ?? null,
        attempts: fila.attempts,
      }));
  }

  async markMediaStored(id: string, objectStorageKey: string): Promise<void> {
    const fila = this.filas.find((candidata) => candidata.id === id);
    if (fila) fila.objectStorageKey = objectStorageKey;
  }

  async markMediaFailed(id: string, _error: string): Promise<void> {
    const fila = this.filas.find((candidata) => candidata.id === id);
    if (fila) fila.attempts += 1;
  }

  async purgeUser(telegramUserId: bigint): Promise<string[]> {
    const claves: string[] = [];
    for (let i = this.filas.length - 1; i >= 0; i -= 1) {
      const fila = this.filas[i];
      if (!fila || fila.telegramUserId !== telegramUserId) continue;
      if (fila.objectStorageKey) claves.push(fila.objectStorageKey);
      this.filas.splice(i, 1);
    }
    return claves;
  }
}
