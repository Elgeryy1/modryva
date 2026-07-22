import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export interface ActivityWindowRow {
  readonly day: string;
  readonly messages: number;
}

export interface TopPosterRow {
  readonly telegramUserId: bigint;
  readonly username: string | undefined;
  readonly messages: number;
}

export interface AnalyticsRepository {
  recordMessage(tenantId: string, chatId: string, day: string): Promise<void>;
  getRecentDays(chatId: string, limit: number): Promise<ActivityWindowRow[]>;
  getTotal(chatId: string): Promise<number>;
  recordUserMessage(input: {
    tenantId: string;
    chatId: string;
    telegramUserId: bigint;
    username: string | undefined;
  }): Promise<void>;
  getTopPosters(chatId: string, limit: number): Promise<TopPosterRow[]>;
  getActiveUserCount(chatId: string): Promise<number>;
  /**
   * Total de mensajes registrados de un usuario en un chat (para modulos como
   * trust-tiers que necesitan el contador plano de un solo miembro).
   */
  getUserMessages(chatId: string, telegramUserId: bigint): Promise<number>;
}

export class PrismaAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async recordMessage(
    tenantId: string,
    chatId: string,
    day: string,
  ): Promise<void> {
    await this.client.activityDaily.upsert({
      where: { chatId_day: { chatId, day } },
      create: { tenantId, chatId, day, messages: 1 },
      update: { messages: { increment: 1 } },
    });
  }

  async getRecentDays(
    chatId: string,
    limit: number,
  ): Promise<ActivityWindowRow[]> {
    const rows = await this.client.activityDaily.findMany({
      where: { chatId },
      orderBy: { day: "desc" },
      take: limit,
    });

    return rows.map((row) => ({ day: row.day, messages: row.messages }));
  }

  async getTotal(chatId: string): Promise<number> {
    const result = await this.client.activityDaily.aggregate({
      where: { chatId },
      _sum: { messages: true },
    });

    return result._sum.messages ?? 0;
  }

  async recordUserMessage(input: {
    tenantId: string;
    chatId: string;
    telegramUserId: bigint;
    username: string | undefined;
  }): Promise<void> {
    await this.client.userActivity.upsert({
      where: {
        chatId_telegramUserId: {
          chatId: input.chatId,
          telegramUserId: input.telegramUserId,
        },
      },
      create: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        telegramUserId: input.telegramUserId,
        ...(input.username ? { username: input.username } : {}),
        messages: 1,
      },
      update: {
        messages: { increment: 1 },
        ...(input.username ? { username: input.username } : {}),
      },
    });
  }

  async getTopPosters(chatId: string, limit: number): Promise<TopPosterRow[]> {
    const rows = await this.client.userActivity.findMany({
      where: { chatId },
      orderBy: { messages: "desc" },
      take: limit,
    });

    return rows.map((row) => ({
      telegramUserId: row.telegramUserId,
      username: row.username ?? undefined,
      messages: row.messages,
    }));
  }

  async getActiveUserCount(chatId: string): Promise<number> {
    return this.client.userActivity.count({ where: { chatId } });
  }

  async getUserMessages(
    chatId: string,
    telegramUserId: bigint,
  ): Promise<number> {
    const row = await this.client.userActivity.findUnique({
      where: { chatId_telegramUserId: { chatId, telegramUserId } },
    });
    return row?.messages ?? 0;
  }
}
