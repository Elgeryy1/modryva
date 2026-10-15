import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export interface FeedRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly chatId: string;
  readonly telegramChatId: bigint;
  readonly url: string;
  readonly lastItemGuid: string | null;
}

export interface FeedRepository {
  addFeed(
    tenantId: string,
    chatId: string,
    telegramChatId: bigint,
    url: string,
    createdBy: string | undefined,
  ): Promise<FeedRecord>;
  listFeeds(chatId: string, limit?: number): Promise<FeedRecord[]>;
  listActive(limit?: number): Promise<FeedRecord[]>;
  removeFeed(chatId: string, feedId: string): Promise<boolean>;
  updateCursor(feedId: string, lastItemGuid: string): Promise<void>;
  /**
   * Records a failed poll and returns how many have now failed in a row, so the
   * caller can decide when a feed has stopped being worth retrying. The reason
   * is stored alongside: the poll loop used to discard it, which left a URL
   * that had never once succeeded looking exactly like a healthy feed with
   * nothing new to deliver.
   */
  recordPollFailure(feedId: string, reason: string): Promise<number>;
  /** Clears the failure streak after any successful poll. */
  clearPollFailures(feedId: string): Promise<void>;
  /** Stops polling a feed without deleting it — the URL and its cursor stay,
   * so re-enabling it is a one-field change rather than a re-add. */
  pauseFeed(feedId: string): Promise<void>;
}

const toRecord = (feed: {
  id: string;
  tenantId: string;
  chatId: string;
  telegramChatId: bigint;
  url: string;
  lastItemGuid: string | null;
}): FeedRecord => ({
  id: feed.id,
  tenantId: feed.tenantId,
  chatId: feed.chatId,
  telegramChatId: feed.telegramChatId,
  url: feed.url,
  lastItemGuid: feed.lastItemGuid,
});

export class PrismaFeedRepository implements FeedRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async addFeed(
    tenantId: string,
    chatId: string,
    telegramChatId: bigint,
    url: string,
    createdBy: string | undefined,
  ): Promise<FeedRecord> {
    const data: Prisma.FeedUncheckedCreateInput = {
      tenantId,
      chatId,
      telegramChatId,
      url,
      ...(createdBy ? { createdBy } : {}),
    };
    const feed = await this.client.feed.upsert({
      where: { chatId_url: { chatId, url } },
      create: data,
      update: { status: "active" },
    });

    return toRecord(feed);
  }

  async listFeeds(chatId: string, limit = 20): Promise<FeedRecord[]> {
    const feeds = await this.client.feed.findMany({
      where: { chatId, status: "active" },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    return feeds.map(toRecord);
  }

  async listActive(limit = 100): Promise<FeedRecord[]> {
    const feeds = await this.client.feed.findMany({
      where: { status: "active" },
      take: limit,
    });

    return feeds.map(toRecord);
  }

  async removeFeed(chatId: string, feedId: string): Promise<boolean> {
    const result = await this.client.feed.deleteMany({
      where: { id: feedId, chatId },
    });

    return result.count > 0;
  }

  async updateCursor(feedId: string, lastItemGuid: string): Promise<void> {
    await this.client.feed.update({
      where: { id: feedId },
      data: {
        lastItemGuid,
        lastPolledAt: new Date(),
        consecutiveFailures: 0,
        lastError: null,
      },
    });
  }

  async recordPollFailure(feedId: string, reason: string): Promise<number> {
    const row = await this.client.feed.update({
      where: { id: feedId },
      data: {
        lastPolledAt: new Date(),
        consecutiveFailures: { increment: 1 },
        // Bounded: an error message is not a log file, and this column is read
        // by humans looking for a cause, not by anything that needs the tail.
        lastError: reason.slice(0, 500),
      },
      select: { consecutiveFailures: true },
    });
    return row.consecutiveFailures;
  }

  async clearPollFailures(feedId: string): Promise<void> {
    await this.client.feed.update({
      where: { id: feedId },
      data: { consecutiveFailures: 0, lastError: null },
    });
  }

  async pauseFeed(feedId: string): Promise<void> {
    await this.client.feed.update({
      where: { id: feedId },
      data: { status: "paused" },
    });
  }
}
