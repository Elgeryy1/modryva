import type { TelegramUpdateEnvelope } from "@superbot/domain";

export type RssCommand =
  | { readonly kind: "add"; readonly url: string }
  | { readonly kind: "list" }
  | { readonly kind: "remove"; readonly feedId: string };

export interface RssCommandError {
  readonly code: "url-required" | "url-invalid" | "id-required" | "usage";
  readonly usage: string;
}

export type RssCommandResult =
  | { readonly ok: true; readonly command: RssCommand }
  | { readonly ok: false; readonly error: RssCommandError };

const rssUsage = "Uso: /rss add <url> | /rss list | /rss remove <id>";

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export const parseRssCommand = (
  update: TelegramUpdateEnvelope,
): RssCommandResult | null => {
  if (update.command?.name !== "rss") {
    return null;
  }

  const args = update.command?.args ?? [];
  const sub = (args[0] ?? "").toLowerCase();

  if (sub === "list") {
    return { ok: true, command: { kind: "list" } };
  }

  if (sub === "remove") {
    const feedId = args[1];
    return feedId
      ? { ok: true, command: { kind: "remove", feedId } }
      : {
          ok: false,
          error: { code: "id-required", usage: "Uso: /rss remove <id>" },
        };
  }

  if (sub === "add") {
    const url = args[1];
    if (!url) {
      return {
        ok: false,
        error: { code: "url-required", usage: "Uso: /rss add <url>" },
      };
    }
    if (!isHttpUrl(url)) {
      return {
        ok: false,
        error: { code: "url-invalid", usage: "La URL debe ser http(s)." },
      };
    }
    return { ok: true, command: { kind: "add", url } };
  }

  return { ok: false, error: { code: "usage", usage: rssUsage } };
};

export interface FeedItem {
  readonly guid: string;
  readonly title: string;
  readonly link: string;
}

const decodeEntities = (value: string): string =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gu, "$1")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/&amp;/gu, "&")
    .trim();

const extractTag = (block: string, tag: string): string | undefined => {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "u").exec(
    block,
  );
  return match?.[1] ? decodeEntities(match[1]) : undefined;
};

const extractLink = (block: string): string | undefined => {
  const plain = extractTag(block, "link");
  if (plain) {
    return plain;
  }
  // Atom uses <link href="..."/>.
  const match = /<link[^>]*href="([^"]+)"[^>]*\/?>(?:<\/link>)?/u.exec(block);
  return match?.[1];
};

/**
 * Minimal RSS/Atom item extractor. Parses `<item>` (RSS) and `<entry>` (Atom)
 * blocks into normalized feed items, newest first as they appear in the feed.
 * Items without a stable id fall back to their link or title.
 */
export const parseFeedItems = (xml: string): FeedItem[] => {
  const blocks = xml.match(/<(item|entry)[\s\S]*?<\/(item|entry)>/gu) ?? [];

  return blocks.map((block) => {
    const title = extractTag(block, "title") ?? "(sin titulo)";
    const link = extractLink(block) ?? "";
    const guid =
      extractTag(block, "guid") ?? extractTag(block, "id") ?? link ?? title;
    return { guid, title, link };
  });
};

/**
 * Returns the items that are newer than `lastSeenGuid` (everything before the
 * first occurrence of that guid, since feeds list newest first). When the guid is
 * not found, all items are considered new.
 */
export const selectNewItems = (
  items: readonly FeedItem[],
  lastSeenGuid: string | undefined,
): FeedItem[] => {
  if (!lastSeenGuid) {
    return [...items];
  }

  const index = items.findIndex((item) => item.guid === lastSeenGuid);
  return index === -1 ? [...items] : items.slice(0, index);
};
