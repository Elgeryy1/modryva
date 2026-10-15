import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * Generic rolling log of chat activity (idea bank ambient-detector cluster):
 * a single flexible table backs many pure detectors (tone shift, hot users,
 * cursed topics, copy-paste spam, crossposting, etc.) that all need a recent
 * window of "what happened in this chat" without a bespoke table each. The
 * pure scoring/ranking logic lives in the modules; this repository only
 * records events and lists a recent window per tenant+chat(+kind).
 */

/** A single recorded chat-activity event. */
export interface ChatActivityEntry {
  readonly telegramUserId: bigint | undefined;
  readonly username: string | undefined;
  readonly text: string | undefined;
  readonly topic: string | undefined;
  readonly messageId: bigint | undefined;
  readonly hasLink: boolean;
  readonly hasMention: boolean;
  readonly isReply: boolean;
  readonly repliedToUserId: bigint | undefined;
  readonly tensionScore: number | undefined;
  readonly createdAt: Date;
}

/** Input to record one chat-activity event. `kind` discriminates the shape callers care about (e.g. "message", "conflict"). */
export interface RecordChatActivityInput {
  readonly tenantId: string;
  readonly chatId: string;
  readonly kind: string;
  readonly telegramUserId?: bigint;
  readonly username?: string;
  readonly text?: string;
  readonly topic?: string;
  readonly messageId?: bigint;
  readonly hasLink?: boolean;
  readonly hasMention?: boolean;
  readonly isReply?: boolean;
  readonly repliedToUserId?: bigint;
  readonly tensionScore?: number;
}

export interface ChatActivityRepository {
  /**
   * Anota un evento de actividad.
   *
   * **Un mensaje deja UNA fila.** Repetir el mismo
   * `(tenantId, chatId, kind: "message", messageId)` no duplica.
   *
   * Hace falta desde que el poller reintenta: cuando un handler falla, el
   * update no se confirma y se reprocesa entero, asi que los handlers que ya
   * habian corrido —este es de los primeros— vuelven a correr. Sin esto, cada
   * reintento sumaba otro mensaje al contador de esa persona.
   *
   * Solo se protege `"message"`, que es el unico tipo con clave natural: un
   * mensaje es uno. `"reaction"` comparte `messageId` entre todos los que
   * reaccionan y `"new_member"` no trae ninguno, asi que ahi no hay por donde
   * deduplicar sin inventarse una clave.
   */
  record(input: RecordChatActivityInput): Promise<void>;
  listRecent(
    tenantId: string,
    chatId: string,
    kind: string,
    limit?: number,
  ): Promise<ChatActivityEntry[]>;
  /**
   * The earliest recorded "message" event carrying this telegram message id in
   * the chat (the original, pre-edit message), or undefined. Backs the
   * edit-risk / edit-spam handler, which compares an edit to its original.
   */
  findOriginalMessage(
    tenantId: string,
    chatId: string,
    messageId: bigint,
  ): Promise<ChatActivityEntry | undefined>;
  /**
   * The calling user's own event of this kind carrying this messageId marker,
   * or undefined. Backs once-per-day features (daily trivia): the marker's
   * messageId is the day key and `text` is "1"/"0" for a correct/wrong answer.
   */
  findUserEvent(
    tenantId: string,
    chatId: string,
    kind: string,
    telegramUserId: bigint,
    messageId: bigint,
  ): Promise<ChatActivityEntry | undefined>;
}

const MAX_PER_KEY = 500;

export class PrismaChatActivityRepository implements ChatActivityRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async record(input: RecordChatActivityInput): Promise<void> {
    // Comprobar-y-luego-insertar, y NO un indice unico, a proposito.
    //
    // El indice seria correcto por construccion, pero crearlo sobre una tabla
    // viva que registra todos los mensajes bloquea escrituras, y si ya hubiera
    // duplicados de antes la migracion fallaria al aplicarse. Queda anotado
    // como el arreglo de verdad, para hacerlo con la base parada.
    //
    // La carrera que normalmente rompe este patron aqui no existe: el mismo
    // update nunca se procesa dos veces a la vez. Los carriles del poller van
    // uno por chat y en orden, y un reintento llega en una vuelta posterior.
    //
    // La consulta usa `@@index([tenantId, chatId, messageId])`, que ya estaba.
    if (input.kind === "message" && input.messageId !== undefined) {
      const yaEstaba = await this.client.chatActivityEvent.findFirst({
        where: {
          tenantId: input.tenantId,
          chatId: input.chatId,
          kind: "message",
          messageId: input.messageId,
        },
        select: { id: true },
      });
      if (yaEstaba) {
        return;
      }
    }

    await this.client.chatActivityEvent.create({
      data: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        kind: input.kind,
        telegramUserId: input.telegramUserId ?? null,
        username: input.username ?? null,
        text: input.text ?? null,
        topic: input.topic ?? null,
        messageId: input.messageId ?? null,
        hasLink: input.hasLink ?? false,
        hasMention: input.hasMention ?? false,
        isReply: input.isReply ?? false,
        repliedToUserId: input.repliedToUserId ?? null,
        tensionScore: input.tensionScore ?? null,
      },
    });
  }

  async listRecent(
    tenantId: string,
    chatId: string,
    kind: string,
    limit = 100,
  ): Promise<ChatActivityEntry[]> {
    const rows = await this.client.chatActivityEvent.findMany({
      where: { tenantId, chatId, kind },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map((row) => ({
      telegramUserId: row.telegramUserId ?? undefined,
      username: row.username ?? undefined,
      text: row.text ?? undefined,
      topic: row.topic ?? undefined,
      messageId: row.messageId ?? undefined,
      hasLink: row.hasLink,
      hasMention: row.hasMention,
      isReply: row.isReply,
      repliedToUserId: row.repliedToUserId ?? undefined,
      tensionScore: row.tensionScore ?? undefined,
      createdAt: row.createdAt,
    }));
  }

  async findOriginalMessage(
    tenantId: string,
    chatId: string,
    messageId: bigint,
  ): Promise<ChatActivityEntry | undefined> {
    const row = await this.client.chatActivityEvent.findFirst({
      where: { tenantId, chatId, kind: "message", messageId },
      orderBy: { createdAt: "asc" },
    });
    if (row === null) {
      return undefined;
    }
    return {
      telegramUserId: row.telegramUserId ?? undefined,
      username: row.username ?? undefined,
      text: row.text ?? undefined,
      topic: row.topic ?? undefined,
      messageId: row.messageId ?? undefined,
      hasLink: row.hasLink,
      hasMention: row.hasMention,
      isReply: row.isReply,
      repliedToUserId: row.repliedToUserId ?? undefined,
      tensionScore: row.tensionScore ?? undefined,
      createdAt: row.createdAt,
    };
  }

  async findUserEvent(
    tenantId: string,
    chatId: string,
    kind: string,
    telegramUserId: bigint,
    messageId: bigint,
  ): Promise<ChatActivityEntry | undefined> {
    const row = await this.client.chatActivityEvent.findFirst({
      where: { tenantId, chatId, kind, telegramUserId, messageId },
      orderBy: { createdAt: "asc" },
    });
    if (row === null) {
      return undefined;
    }
    return {
      telegramUserId: row.telegramUserId ?? undefined,
      username: row.username ?? undefined,
      text: row.text ?? undefined,
      topic: row.topic ?? undefined,
      messageId: row.messageId ?? undefined,
      hasLink: row.hasLink,
      hasMention: row.hasMention,
      isReply: row.isReply,
      repliedToUserId: row.repliedToUserId ?? undefined,
      tensionScore: row.tensionScore ?? undefined,
      createdAt: row.createdAt,
    };
  }
}

/** Store en memoria usado como default del constructor (tests). */
export class InMemoryChatActivityRepository implements ChatActivityRepository {
  private events = new Map<string, ChatActivityEntry[]>();

  private key(tenantId: string, chatId: string, kind: string): string {
    return `${tenantId}:${chatId}:${kind}`;
  }

  async record(input: RecordChatActivityInput): Promise<void> {
    const key = this.key(input.tenantId, input.chatId, input.kind);
    // El doble tiene que deduplicar igual que Prisma. Si no, los tests darian
    // verde sobre un comportamiento que la base no tiene.
    if (input.kind === "message" && input.messageId !== undefined) {
      const yaEstaba = (this.events.get(key) ?? []).some(
        (e) => e.messageId === input.messageId,
      );
      if (yaEstaba) {
        return;
      }
    }
    const entry: ChatActivityEntry = {
      telegramUserId: input.telegramUserId,
      username: input.username,
      text: input.text,
      topic: input.topic,
      messageId: input.messageId,
      hasLink: input.hasLink ?? false,
      hasMention: input.hasMention ?? false,
      isReply: input.isReply ?? false,
      repliedToUserId: input.repliedToUserId,
      tensionScore: input.tensionScore,
      createdAt: new Date(),
    };
    const list = this.events.get(key) ?? [];
    list.unshift(entry);
    if (list.length > MAX_PER_KEY) {
      list.length = MAX_PER_KEY;
    }
    this.events.set(key, list);
  }

  async listRecent(
    tenantId: string,
    chatId: string,
    kind: string,
    limit = 100,
  ): Promise<ChatActivityEntry[]> {
    const list = this.events.get(this.key(tenantId, chatId, kind)) ?? [];
    return list.slice(0, limit);
  }

  async findOriginalMessage(
    tenantId: string,
    chatId: string,
    messageId: bigint,
  ): Promise<ChatActivityEntry | undefined> {
    const list = this.events.get(this.key(tenantId, chatId, "message")) ?? [];
    let original: ChatActivityEntry | undefined;
    for (const entry of list) {
      if (
        entry.messageId === messageId &&
        (original === undefined || entry.createdAt < original.createdAt)
      ) {
        original = entry;
      }
    }
    return original;
  }

  async findUserEvent(
    tenantId: string,
    chatId: string,
    kind: string,
    telegramUserId: bigint,
    messageId: bigint,
  ): Promise<ChatActivityEntry | undefined> {
    const list = this.events.get(this.key(tenantId, chatId, kind)) ?? [];
    return list.find(
      (entry) =>
        entry.telegramUserId === telegramUserId &&
        entry.messageId === messageId,
    );
  }
}
