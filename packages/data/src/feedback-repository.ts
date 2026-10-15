import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * Livegram-style feedback inbox: a configured staff group receives users' DMs,
 * and a registry of everyone who has written the bot enables broadcasts.
 */
export interface FeedbackRepository {
  setStaffChat(tenantId: string, staffTelegramChatId: bigint): Promise<void>;
  getStaffChat(tenantId: string): Promise<bigint | null>;
  addUser(tenantId: string, telegramUserId: bigint): Promise<void>;
  listUsers(tenantId: string): Promise<bigint[]>;
}

export class PrismaFeedbackRepository implements FeedbackRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async setStaffChat(
    tenantId: string,
    staffTelegramChatId: bigint,
  ): Promise<void> {
    await this.client.feedbackConfig.upsert({
      where: { tenantId },
      create: { tenantId, staffTelegramChatId },
      update: { staffTelegramChatId },
    });
  }

  async getStaffChat(tenantId: string): Promise<bigint | null> {
    const config = await this.client.feedbackConfig.findUnique({
      where: { tenantId },
    });
    return config?.staffTelegramChatId ?? null;
  }

  async addUser(tenantId: string, telegramUserId: bigint): Promise<void> {
    await this.client.feedbackUser.upsert({
      where: { tenantId_telegramUserId: { tenantId, telegramUserId } },
      create: { tenantId, telegramUserId },
      update: {},
    });
  }

  async listUsers(tenantId: string): Promise<bigint[]> {
    const users = await this.client.feedbackUser.findMany({
      where: { tenantId },
    });
    return users.map((user) => user.telegramUserId);
  }
}

/** In-memory feedback store used as the constructor default (tests). */
export class InMemoryFeedbackRepository implements FeedbackRepository {
  private staff = new Map<string, bigint>();
  private users = new Map<string, Set<string>>();

  async setStaffChat(
    tenantId: string,
    staffTelegramChatId: bigint,
  ): Promise<void> {
    this.staff.set(tenantId, staffTelegramChatId);
  }

  async getStaffChat(tenantId: string): Promise<bigint | null> {
    return this.staff.get(tenantId) ?? null;
  }

  async addUser(tenantId: string, telegramUserId: bigint): Promise<void> {
    const set = this.users.get(tenantId) ?? new Set<string>();
    set.add(telegramUserId.toString());
    this.users.set(tenantId, set);
  }

  async listUsers(tenantId: string): Promise<bigint[]> {
    return [...(this.users.get(tenantId) ?? [])].map((id) => BigInt(id));
  }
}
