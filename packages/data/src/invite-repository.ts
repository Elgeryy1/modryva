import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export interface InviteStatState {
  readonly inviterTelegramId: bigint;
  readonly count: number;
}

export interface InviteRepository {
  addInvites(
    tenantId: string,
    chatId: string,
    inviterTelegramId: bigint,
    delta: number,
  ): Promise<InviteStatState>;
  getCount(chatId: string, inviterTelegramId: bigint): Promise<number>;
  topInviters(chatId: string, limit: number): Promise<InviteStatState[]>;
}

const toState = (stat: {
  inviterTelegramId: bigint;
  count: number;
}): InviteStatState => ({
  inviterTelegramId: stat.inviterTelegramId,
  count: stat.count,
});

export class PrismaInviteRepository implements InviteRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async addInvites(
    tenantId: string,
    chatId: string,
    inviterTelegramId: bigint,
    delta: number,
  ): Promise<InviteStatState> {
    const stat = await this.client.inviteStat.upsert({
      where: { chatId_inviterTelegramId: { chatId, inviterTelegramId } },
      create: { tenantId, chatId, inviterTelegramId, count: delta },
      update: { count: { increment: delta } },
    });

    return toState(stat);
  }

  async getCount(chatId: string, inviterTelegramId: bigint): Promise<number> {
    const stat = await this.client.inviteStat.findUnique({
      where: { chatId_inviterTelegramId: { chatId, inviterTelegramId } },
    });

    return stat?.count ?? 0;
  }

  async topInviters(chatId: string, limit: number): Promise<InviteStatState[]> {
    const stats = await this.client.inviteStat.findMany({
      where: { chatId },
      orderBy: { count: "desc" },
      take: limit,
    });

    return stats.map(toState);
  }
}
