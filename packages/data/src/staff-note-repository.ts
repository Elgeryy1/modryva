import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * Notas internas de staff por chat (idea #44): un bloc compartido donde el
 * staff deja anotaciones y contexto sobre incidencias del grupo. La logica pura
 * de parseo/formato vive en @superbot/module-security (case-notes); aqui solo
 * esta la persistencia scoped por tenant + chat.
 */

/** Una nota ya persistida, lista para renderizar. `createdAtMs` es epoch en ms. */
export interface StaffNoteRecord {
  readonly id: string;
  readonly authorName: string | null;
  readonly text: string;
  readonly createdAtMs: number;
}

/** Datos para crear una nota nueva. */
export interface StaffNoteInput {
  readonly tenantId: string;
  readonly chatId: string;
  readonly authorTelegramId: bigint | null;
  readonly authorName: string | null;
  readonly text: string;
}

export interface StaffNoteRepository {
  addNote(input: StaffNoteInput): Promise<void>;
  /** Devuelve las notas mas recientes primero, hasta `limit`. */
  listNotes(
    tenantId: string,
    chatId: string,
    limit: number,
  ): Promise<StaffNoteRecord[]>;
  /**
   * Borra una nota. Scoped por tenant + chat, de modo que un admin de un grupo
   * no puede borrar una nota de otro grupo aunque comparta tenant. Devuelve true
   * si borro algo.
   */
  deleteNote(tenantId: string, chatId: string, id: string): Promise<boolean>;
}

export class PrismaStaffNoteRepository implements StaffNoteRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async addNote(input: StaffNoteInput): Promise<void> {
    await this.client.staffNote.create({
      data: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        authorTelegramId: input.authorTelegramId,
        authorName: input.authorName,
        text: input.text,
      },
    });
  }

  async listNotes(
    tenantId: string,
    chatId: string,
    limit: number,
  ): Promise<StaffNoteRecord[]> {
    const notes = await this.client.staffNote.findMany({
      where: { tenantId, chatId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return notes.map((note) => ({
      id: note.id,
      authorName: note.authorName,
      text: note.text,
      createdAtMs: note.createdAt.getTime(),
    }));
  }

  async deleteNote(
    tenantId: string,
    chatId: string,
    id: string,
  ): Promise<boolean> {
    const result = await this.client.staffNote.deleteMany({
      where: { id, tenantId, chatId },
    });
    return result.count > 0;
  }
}

/** Store en memoria usado como default del constructor (tests). */
export class InMemoryStaffNoteRepository implements StaffNoteRepository {
  private notes = new Map<string, StaffNoteRecord[]>();
  private seq = 0;

  private key(tenantId: string, chatId: string): string {
    return `${tenantId}:${chatId}`;
  }

  async addNote(input: StaffNoteInput): Promise<void> {
    const key = this.key(input.tenantId, input.chatId);
    const list = this.notes.get(key) ?? [];
    this.seq += 1;
    list.push({
      id: `note_${this.seq}`,
      authorName: input.authorName,
      text: input.text,
      createdAtMs: list.length,
    });
    this.notes.set(key, list);
  }

  async listNotes(
    tenantId: string,
    chatId: string,
    limit: number,
  ): Promise<StaffNoteRecord[]> {
    const list = this.notes.get(this.key(tenantId, chatId)) ?? [];
    return [...list].reverse().slice(0, limit);
  }

  async deleteNote(
    tenantId: string,
    chatId: string,
    id: string,
  ): Promise<boolean> {
    const key = this.key(tenantId, chatId);
    const list = this.notes.get(key);
    if (!list) {
      return false;
    }
    const next = list.filter((note) => note.id !== id);
    if (next.length === list.length) {
      return false;
    }
    this.notes.set(key, next);
    return true;
  }
}
