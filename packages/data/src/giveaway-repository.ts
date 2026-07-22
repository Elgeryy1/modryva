import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export interface GiveawayRecord {
  readonly id: string;
  readonly prize: string;
  readonly status: string;
}

export interface GiveawayRepository {
  createGiveaway(
    tenantId: string,
    chatId: string,
    prize: string,
    createdBy: string | undefined,
  ): Promise<GiveawayRecord>;
  getGiveaway(giveawayId: string): Promise<GiveawayRecord | null>;
  addEntry(giveawayId: string, telegramUserId: bigint): Promise<void>;
  listEntrants(giveawayId: string): Promise<bigint[]>;
  closeWithWinner(
    giveawayId: string,
    seed: string,
    winnerTelegramId: bigint,
  ): Promise<void>;
}

export class PrismaGiveawayRepository implements GiveawayRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async createGiveaway(
    tenantId: string,
    chatId: string,
    prize: string,
    createdBy: string | undefined,
  ): Promise<GiveawayRecord> {
    const giveaway = await this.client.giveaway.create({
      data: { tenantId, chatId, prize, ...(createdBy ? { createdBy } : {}) },
    });

    return { id: giveaway.id, prize: giveaway.prize, status: giveaway.status };
  }

  async getGiveaway(giveawayId: string): Promise<GiveawayRecord | null> {
    const giveaway = await this.client.giveaway.findUnique({
      where: { id: giveawayId },
    });

    return giveaway
      ? { id: giveaway.id, prize: giveaway.prize, status: giveaway.status }
      : null;
  }

  async addEntry(giveawayId: string, telegramUserId: bigint): Promise<void> {
    await this.client.giveawayEntry.upsert({
      where: { giveawayId_telegramUserId: { giveawayId, telegramUserId } },
      create: { giveawayId, telegramUserId },
      update: {},
    });
  }

  async listEntrants(giveawayId: string): Promise<bigint[]> {
    const entries = await this.client.giveawayEntry.findMany({
      where: { giveawayId },
      select: { telegramUserId: true },
    });

    return entries.map((entry) => entry.telegramUserId);
  }

  async closeWithWinner(
    giveawayId: string,
    seed: string,
    winnerTelegramId: bigint,
  ): Promise<void> {
    await this.client.giveaway.update({
      where: { id: giveawayId },
      data: { status: "closed", seed, winnerTelegramId },
    });
  }
}
