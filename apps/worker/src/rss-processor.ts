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
  /**
   * Which feeds failed and why. Returned rather than logged here so the
   * processor stays free of a logger — the job runner already prints this
   * summary, which is exactly where a reason belonged all along. Without it, a
   * URL that had never once succeeded looked identical to a healthy feed with
   * nothing new: `errors: 1` and no way to tell which feed or what happened.
   */
  readonly failures: readonly {
    readonly url: string;
    readonly reason: string;
    readonly consecutive: number;
    readonly paused: boolean;
  }[];
}

/**
 * Consecutive failures before a feed stops being polled. Generous: feeds go
 * down for a few hours all the time, and pausing a good feed is worse than a
 * few wasted fetches. The case this exists for is the other one — a dead URL
 * fetched every 60 seconds for 23 days, reporting `errors: 1` into a log
 * nobody could act on.
 */
const MAX_CONSECUTIVE_FAILURES = 20;

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
  const failures: {
    url: string;
    reason: string;
    consecutive: number;
    paused: boolean;
  }[] = [];
  let delivered = 0;
  let errors = 0;

  for (const feed of feeds) {
    try {
      const xml = await context.fetcher(feed.url);
      const items = parseFeedItems(xml);

      if (items.length === 0) {
        // Reachable and parseable, just empty — not a failure. Every other exit
        // below runs through updateCursor, which clears the streak itself; this
        // path does not, and without it a feed that legitimately publishes
        // nothing would accumulate its way to being paused.
        await context.feeds.clearPollFailures(feed.id);
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
    } catch (error) {
      errors += 1;
      const reason = error instanceof Error ? error.message : String(error);
      // Best-effort bookkeeping: if recording the failure ALSO fails, the poll
      // must still report what went wrong with the feed itself rather than
      // replacing it with a database error nobody asked about.
      let consecutive = 0;
      let paused = false;
      try {
        consecutive = await context.feeds.recordPollFailure(feed.id, reason);
        if (consecutive >= MAX_CONSECUTIVE_FAILURES) {
          await context.feeds.pauseFeed(feed.id);
          paused = true;
        }
      } catch {
        // Leave consecutive at 0 — the reason below is the part that matters.
      }
      failures.push({ url: feed.url, reason, consecutive, paused });
    }
  }

  return { feeds: feeds.length, delivered, errors, failures };
};
