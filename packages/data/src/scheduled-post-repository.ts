import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export interface ScheduledPostRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly telegramChatId: bigint;
  readonly text: string;
  readonly runAt: Date;
}

export interface CreateScheduledPostInput {
  readonly tenantId: string;
  readonly chatId: string;
  readonly telegramChatId: bigint;
  readonly text: string;
  readonly runAt: Date;
  readonly createdBy?: string;
}

export interface ScheduledPostRepository {
  create(input: CreateScheduledPostInput): Promise<ScheduledPostRecord>;
  listPending(chatId: string, limit?: number): Promise<ScheduledPostRecord[]>;
  listDue(now: Date, limit?: number): Promise<ScheduledPostRecord[]>;
  markSent(id: string): Promise<void>;
  markFailed(id: string): Promise<void>;
  cancel(chatId: string, id: string): Promise<boolean>;
  /**
   * Toggles a user's reaction on a message (ControllerBot-style reaction
   * buttons). Selecting the same emoji removes it; a different emoji switches.
   * Returns the updated per-emoji counts.
   */
  toggleReaction(input: {
    tenantId: string;
    chatId: string;
    messageId: number;
    telegramUserId: bigint;
    emoji: string;
  }): Promise<Record<string, number>>;
  countReactions(
    chatId: string,
    messageId: number,
  ): Promise<Record<string, number>>;
}

const toRecord = (post: {
  id: string;
  tenantId: string;
  telegramChatId: bigint;
  text: string;
  runAt: Date;
}): ScheduledPostRecord => ({
  id: post.id,
  tenantId: post.tenantId,
  telegramChatId: post.telegramChatId,
  text: post.text,
  runAt: post.runAt,
});

export class PrismaScheduledPostRepository implements ScheduledPostRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async create(input: CreateScheduledPostInput): Promise<ScheduledPostRecord> {
    const post = await this.client.scheduledPost.create({
      data: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        telegramChatId: input.telegramChatId,
        text: input.text,
        runAt: input.runAt,
        ...(input.createdBy ? { createdBy: input.createdBy } : {}),
      },
    });

    return toRecord(post);
  }

  async listPending(
    chatId: string,
    limit = 20,
  ): Promise<ScheduledPostRecord[]> {
    const posts = await this.client.scheduledPost.findMany({
      where: { chatId, status: "pending" },
      orderBy: { runAt: "asc" },
      take: limit,
    });

    return posts.map(toRecord);
  }

  async listDue(now: Date, limit = 50): Promise<ScheduledPostRecord[]> {
    const posts = await this.client.scheduledPost.findMany({
      where: { status: "pending", runAt: { lte: now } },
      take: limit,
    });

    return posts.map(toRecord);
  }

  async markSent(id: string): Promise<void> {
    await this.client.scheduledPost.update({
      where: { id },
      data: { status: "sent", sentAt: new Date() },
    });
  }

  async markFailed(id: string): Promise<void> {
    await this.client.scheduledPost.update({
      where: { id },
      data: { status: "failed" },
    });
  }

  async cancel(chatId: string, id: string): Promise<boolean> {
    const result = await this.client.scheduledPost.deleteMany({
      where: { id, chatId, status: "pending" },
    });

    return result.count > 0;
  }

  async toggleReaction(input: {
    tenantId: string;
    chatId: string;
    messageId: number;
    telegramUserId: bigint;
    emoji: string;
  }): Promise<Record<string, number>> {
    const existing = await this.client.postReaction.findUnique({
      where: {
        chatId_messageId_telegramUserId: {
          chatId: input.chatId,
          messageId: input.messageId,
          telegramUserId: input.telegramUserId,
        },
      },
    });

    if (existing?.emoji === input.emoji) {
      await this.client.postReaction.delete({ where: { id: existing.id } });
    } else if (existing) {
      await this.client.postReaction.update({
        where: { id: existing.id },
        data: { emoji: input.emoji },
      });
    } else {
      await this.client.postReaction.create({
        data: {
          tenantId: input.tenantId,
          chatId: input.chatId,
          messageId: input.messageId,
          telegramUserId: input.telegramUserId,
          emoji: input.emoji,
        },
      });
    }

    return this.countReactions(input.chatId, input.messageId);
  }

  async countReactions(
    chatId: string,
    messageId: number,
  ): Promise<Record<string, number>> {
    const rows = await this.client.postReaction.groupBy({
      by: ["emoji"],
      where: { chatId, messageId },
      _count: { emoji: true },
    });

    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.emoji] = row._count.emoji;
    }
    return counts;
  }
}
