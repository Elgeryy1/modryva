import type { FeedRecord, FeedRepository } from "@superbot/data";
import type { TelegramGatewayResult } from "@superbot/telegram";
import { describe, expect, it } from "vitest";
import { processFeeds } from "./rss-processor.js";

const ok: TelegramGatewayResult = { ok: true, skipped: false };

const feedXml = `<rss><channel>
  <item><title>New 2</title><link>https://e.com/2</link><guid>g2</guid></item>
  <item><title>New 1</title><link>https://e.com/1</link><guid>g1</guid></item>
  <item><title>Old</title><link>https://e.com/0</link><guid>g0</guid></item>
</channel></rss>`;

class FakeFeedRepository implements FeedRepository {
  cursors: Record<string, string> = {};

  constructor(private readonly feeds: FeedRecord[] = []) {}

  async addFeed(): Promise<FeedRecord> {
    throw new Error("not used");
  }
  async listFeeds(): Promise<FeedRecord[]> {
    return this.feeds;
  }
  async listActive(): Promise<FeedRecord[]> {
    return this.feeds;
  }
  async removeFeed(): Promise<boolean> {
    return false;
  }
  async updateCursor(feedId: string, lastItemGuid: string): Promise<void> {
    this.cursors[feedId] = lastItemGuid;
  }
}

describe("processFeeds", () => {
  it("delivers only items newer than the cursor and advances it", async () => {
    const feeds = new FakeFeedRepository([
      {
        id: "fd1",
        tenantId: "t",
        chatId: "c",
        telegramChatId: -100n,
        url: "https://e.com/feed.xml",
        lastItemGuid: "g0",
      },
    ]);
    const sent: string[] = [];
    const gateway = {
      async sendMessage(input: {
        chatId: bigint;
        reply: { text: string };
        token: string | undefined;
      }): Promise<TelegramGatewayResult> {
        sent.push(input.reply.text);
        return ok;
      },
    };

    const summary = await processFeeds({
      feeds,
      gateway,
      fetcher: async () => feedXml,
      resolveBotToken: async () => "secret",
    });

    // Two new items (g1, g2) delivered oldest-first.
    expect(sent).toHaveLength(2);
    expect(sent[0]).toContain("New 1");
    expect(sent[1]).toContain("New 2");
    expect(feeds.cursors.fd1).toBe("g2");
    expect(summary).toEqual({ feeds: 1, delivered: 2, errors: 0 });
  });

  it("isolates a failing feed without throwing", async () => {
    const feeds = new FakeFeedRepository([
      {
        id: "fd1",
        tenantId: "t",
        chatId: "c",
        telegramChatId: -100n,
        url: "https://e.com/bad.xml",
        lastItemGuid: null,
      },
    ]);
    const gateway = {
      async sendMessage(): Promise<TelegramGatewayResult> {
        return ok;
      },
    };

    const summary = await processFeeds({
      feeds,
      gateway,
      fetcher: async () => {
        throw new Error("network");
      },
      resolveBotToken: async () => "secret",
    });

    expect(summary.errors).toBe(1);
    expect(summary.delivered).toBe(0);
  });

  it("delivers each feed's items with its own tenant's resolved bot token", async () => {
    const feeds = new FakeFeedRepository([
      {
        id: "fd1",
        tenantId: "t1",
        chatId: "c1",
        telegramChatId: -100n,
        url: "https://e.com/feed1.xml",
        lastItemGuid: "g0",
      },
      {
        id: "fd2",
        tenantId: "t2",
        chatId: "c2",
        telegramChatId: -200n,
        url: "https://e.com/feed2.xml",
        lastItemGuid: "g0",
      },
    ]);
    const tokensUsed: Array<string | undefined> = [];
    const gateway = {
      async sendMessage(input: {
        chatId: bigint;
        reply: { text: string };
        token: string | undefined;
      }): Promise<TelegramGatewayResult> {
        tokensUsed.push(input.token);
        return ok;
      },
    };
    const tokensByTenant: Record<string, string> = {
      t1: "token-t1",
      t2: "token-t2",
    };

    await processFeeds({
      feeds,
      gateway,
      fetcher: async () => feedXml,
      resolveBotToken: async (tenantId) => tokensByTenant[tenantId],
    });

    // Each feed delivers 2 new items (g1, g2), all with that feed's own token.
    expect(tokensUsed).toEqual([
      "token-t1",
      "token-t1",
      "token-t2",
      "token-t2",
    ]);
  });

  it("stops at the first non-throwing delivery failure and does not advance the cursor past it", async () => {
    const feeds = new FakeFeedRepository([
      {
        id: "fd1",
        tenantId: "t",
        chatId: "c",
        telegramChatId: -100n,
        url: "https://e.com/feed.xml",
        lastItemGuid: "g0",
      },
    ]);
    const sent: string[] = [];
    const gateway = {
      async sendMessage(input: {
        chatId: bigint;
        reply: { text: string };
        token: string | undefined;
      }): Promise<TelegramGatewayResult> {
        sent.push(input.reply.text);
        // First send ("New 1") succeeds; second ("New 2") fails without throwing.
        return sent.length === 1
          ? { ok: true, skipped: false }
          : { ok: false, skipped: true, reason: "missing-token" };
      },
    };

    const summary = await processFeeds({
      feeds,
      gateway,
      fetcher: async () => feedXml,
      resolveBotToken: async () => "secret",
    });

    expect(sent).toHaveLength(2);
    expect(summary).toEqual({ feeds: 1, delivered: 1, errors: 1 });
    // Cursor advances only to the last CONFIRMED delivery (g1), not to g2 — so
    // the failed item is retried on the next poll instead of lost.
    expect(feeds.cursors.fd1).toBe("g1");
  });

  it("leaves the cursor untouched when the very first fresh item fails, so every item is retried next cycle", async () => {
    const feeds = new FakeFeedRepository([
      {
        id: "fd1",
        tenantId: "t",
        chatId: "c",
        telegramChatId: -100n,
        url: "https://e.com/feed.xml",
        lastItemGuid: "g0",
      },
    ]);
    const sent: string[] = [];
    const gateway = {
      async sendMessage(input: {
        chatId: bigint;
        reply: { text: string };
        token: string | undefined;
      }): Promise<TelegramGatewayResult> {
        sent.push(input.reply.text);
        return { ok: false, skipped: true, reason: "missing-token" };
      },
    };

    const summary = await processFeeds({
      feeds,
      gateway,
      fetcher: async () => feedXml,
      resolveBotToken: async () => undefined,
    });

    // Only the first ("New 1") is attempted — loop breaks before "New 2".
    expect(sent).toEqual(["📰 New 1\nhttps://e.com/1"]);
    expect(summary).toEqual({ feeds: 1, delivered: 0, errors: 1 });
    // updateCursor was never called — feed.lastItemGuid stays "g0" next cycle.
    expect(feeds.cursors.fd1).toBeUndefined();
  });
});
