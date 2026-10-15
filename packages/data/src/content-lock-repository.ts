import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

const toJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const readLocked = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

export interface ContentLockRepository {
  getLocked(tenantId: string, chatId: string): Promise<string[]>;
  setLocked(
    tenantId: string,
    chatId: string,
    locked: readonly string[],
  ): Promise<string[]>;
}

export class PrismaContentLockRepository implements ContentLockRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async getLocked(_tenantId: string, chatId: string): Promise<string[]> {
    const config = await this.client.contentLockConfig.findUnique({
      where: { chatId },
    });

    return config ? readLocked(config.locked) : [];
  }

  async setLocked(
    tenantId: string,
    chatId: string,
    locked: readonly string[],
  ): Promise<string[]> {
    const unique = [...new Set(locked)].sort();
    const config = await this.client.contentLockConfig.upsert({
      where: { chatId },
      create: { tenantId, chatId, locked: toJson(unique) },
      update: { locked: toJson(unique) },
    });

    return readLocked(config.locked);
  }
}
