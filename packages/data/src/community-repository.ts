import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export interface NoteRecord {
  readonly name: string;
  readonly content: string;
}

export interface NotesRepository {
  saveNote(
    tenantId: string,
    chatId: string,
    name: string,
    content: string,
    createdBy: string | undefined,
  ): Promise<void>;
  getNote(chatId: string, name: string): Promise<NoteRecord | null>;
  listNotes(chatId: string): Promise<string[]>;
  listNotesDetailed(chatId: string, limit?: number): Promise<NoteRecord[]>;
  searchNotes(
    tenantId: string,
    query: string,
    limit?: number,
  ): Promise<NoteRecord[]>;
  deleteNote(chatId: string, name: string): Promise<boolean>;
}

export interface FilterRecord {
  readonly trigger: string;
  readonly response: string;
}

export interface FiltersRepository {
  saveFilter(
    tenantId: string,
    chatId: string,
    trigger: string,
    response: string,
    createdBy: string | undefined,
  ): Promise<void>;
  listFilters(chatId: string): Promise<FilterRecord[]>;
  deleteFilter(chatId: string, trigger: string): Promise<boolean>;
}

export class PrismaNotesRepository implements NotesRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async saveNote(
    tenantId: string,
    chatId: string,
    name: string,
    content: string,
    createdBy: string | undefined,
  ): Promise<void> {
    await this.client.note.upsert({
      where: { chatId_name: { chatId, name } },
      create: {
        tenantId,
        chatId,
        name,
        content,
        ...(createdBy ? { createdBy } : {}),
      },
      update: { content },
    });
  }

  async getNote(chatId: string, name: string): Promise<NoteRecord | null> {
    const note = await this.client.note.findUnique({
      where: { chatId_name: { chatId, name } },
    });

    return note ? { name: note.name, content: note.content } : null;
  }

  async listNotes(chatId: string): Promise<string[]> {
    const notes = await this.client.note.findMany({
      where: { chatId },
      orderBy: { name: "asc" },
      select: { name: true },
    });

    return notes.map((note) => note.name);
  }

  async listNotesDetailed(chatId: string, limit = 200): Promise<NoteRecord[]> {
    const notes = await this.client.note.findMany({
      where: { chatId },
      orderBy: { name: "asc" },
      take: limit,
    });

    return notes.map((note) => ({ name: note.name, content: note.content }));
  }

  async searchNotes(
    tenantId: string,
    query: string,
    limit = 10,
  ): Promise<NoteRecord[]> {
    const trimmed = query.trim();
    const notes = await this.client.note.findMany({
      where: {
        tenantId,
        ...(trimmed
          ? {
              OR: [
                { name: { contains: trimmed, mode: "insensitive" } },
                { content: { contains: trimmed, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      take: limit,
    });

    return notes.map((note) => ({ name: note.name, content: note.content }));
  }

  async deleteNote(chatId: string, name: string): Promise<boolean> {
    const result = await this.client.note.deleteMany({
      where: { chatId, name },
    });

    return result.count > 0;
  }
}

export class PrismaFiltersRepository implements FiltersRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async saveFilter(
    tenantId: string,
    chatId: string,
    trigger: string,
    response: string,
    createdBy: string | undefined,
  ): Promise<void> {
    await this.client.filter.upsert({
      where: { chatId_trigger: { chatId, trigger } },
      create: {
        tenantId,
        chatId,
        trigger,
        response,
        ...(createdBy ? { createdBy } : {}),
      },
      update: { response },
    });
  }

  async listFilters(chatId: string): Promise<FilterRecord[]> {
    const filters = await this.client.filter.findMany({
      where: { chatId },
      orderBy: { trigger: "asc" },
    });

    return filters.map((filter) => ({
      trigger: filter.trigger,
      response: filter.response,
    }));
  }

  async deleteFilter(chatId: string, trigger: string): Promise<boolean> {
    const result = await this.client.filter.deleteMany({
      where: { chatId, trigger },
    });

    return result.count > 0;
  }
}
