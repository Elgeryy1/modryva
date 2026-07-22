import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export interface CustomCommandRecord {
  readonly name: string;
  readonly response: string;
}

export interface CustomCommandRepository {
  upsert(
    tenantId: string,
    chatId: string,
    name: string,
    response: string,
    createdBy: string | undefined,
  ): Promise<void>;
  remove(chatId: string, name: string): Promise<boolean>;
  list(chatId: string, limit?: number): Promise<CustomCommandRecord[]>;
  get(chatId: string, name: string): Promise<CustomCommandRecord | null>;
}

export class PrismaCustomCommandRepository implements CustomCommandRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async upsert(
    tenantId: string,
    chatId: string,
    name: string,
    response: string,
    createdBy: string | undefined,
  ): Promise<void> {
    await this.client.customCommand.upsert({
      where: { chatId_name: { chatId, name } },
      create: {
        tenantId,
        chatId,
        name,
        response,
        ...(createdBy ? { createdBy } : {}),
      },
      update: { response },
    });
  }

  async remove(chatId: string, name: string): Promise<boolean> {
    const result = await this.client.customCommand.deleteMany({
      where: { chatId, name },
    });
    return result.count > 0;
  }

  async list(chatId: string, limit = 50): Promise<CustomCommandRecord[]> {
    const commands = await this.client.customCommand.findMany({
      where: { chatId },
      orderBy: { name: "asc" },
      take: limit,
    });
    return commands.map((command) => ({
      name: command.name,
      response: command.response,
    }));
  }

  async get(chatId: string, name: string): Promise<CustomCommandRecord | null> {
    const command = await this.client.customCommand.findUnique({
      where: { chatId_name: { chatId, name } },
    });
    return command ? { name: command.name, response: command.response } : null;
  }
}
