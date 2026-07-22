import type { FeedRepository } from "@superbot/data";
import { parseFeedItems, selectNewItems } from "@superbot/module-automation";
import type { TelegramGatewayResult } from "@superbot/telegram";

export interface RssPublishGateway {
  sendMessage(input: {
    chatId: bigint;
    reply: { text: string };
    token: string | undefined;
  }): Promise<TelegramGatewayResult>;
}

export type FeedFetcher = (url: string) => Promise<string>;

export interface RssContext {
  readonly feeds: FeedRepository;
  readonly gateway: RssPublishGateway;
  readonly fetcher: FeedFetcher;
  /** Resolves the bot token for a feed's own tenant (primary or active managed child). */
  readonly resolveBotToken: (tenantId: string) => Promise<string | undefined>;
  /** Max new items delivered per feed per poll to avoid floods on first sync. */
  readonly maxPerFeed?: number;
}

export interface RssSummary {
  readonly feeds: number;
  readonly delivered: number;
  readonly errors: number;
}

/**
 * rss.poll.due — polls each active feed, delivers items newer than the stored
 * cursor (oldest first) and advances the cursor only past items that were
 * actually confirmed delivered. Fetch/parse failures (thrown) are isolated
 * per feed so one broken feed never blocks the rest; a non-throwing delivery
 * failure (gateway returns { ok: false }, e.g. a missing/revoked bot token)
 * stops that feed's delivery for this cycle instead of skipping past it — the
 * failed item and anything newer stay "fresh" so rss.poll.due retries them on
 * the next cycle.
 */
export const processFeeds = async (
  context: RssContext,
): Promise<RssSummary> => {
  const feeds = await context.feeds.listActive();
  const maxPerFeed = context.maxPerFeed ?? 5;
  let delivered = 0;
  let errors = 0;

  for (const feed of feeds) {
    try {
      const xml = await context.fetcher(feed.url);
      const items = parseFeedItems(xml);

      if (items.length === 0) {
        continue;
      }

      const fresh = selectNewItems(items, feed.lastItemGuid ?? undefined)
        .slice(0, maxPerFeed)
        .reverse();

      if (fresh.length === 0) {
        // Nothing new to attempt — still refresh lastPolledAt via a
        // same-guid cursor write, matching prior behavior.
        const newest = items[0];
        if (newest) {
          await context.feeds.updateCursor(feed.id, newest.guid);
        }
        continue;
      }

      const token = await context.resolveBotToken(feed.tenantId);
      let lastDeliveredGuid: string | undefined;

      for (const item of fresh) {
        const result = await context.gateway.sendMessage({
          chatId: feed.telegramChatId,
          reply: { text: `📰 ${item.title}\n${item.link}` },
          token,
        });
        if (result.ok) {
          delivered += 1;
          lastDeliveredGuid = item.guid;
        } else {
          errors += 1;
          // Stop here: don't let the cursor skip past an item that was never
          // confirmed delivered, and don't risk out-of-order/duplicate
          // posting by attempting later items this cycle.
          break;
        }
      }

      if (lastDeliveredGuid) {
        await context.feeds.updateCursor(feed.id, lastDeliveredGuid);
      }
    } catch {
      errors += 1;
    }
  }

  return { feeds: feeds.length, delivered, errors };
};
