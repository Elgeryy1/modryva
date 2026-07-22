import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";
import { parseFeedItems, parseRssCommand, selectNewItems } from "./rss.js";

const emptyContent: MessageContentFlags = {
  hasText: false,
  hasUrl: false,
  hasMention: false,
  isForward: false,
  viaBot: false,
  hasPhoto: false,
  hasVideo: false,
  hasAnimation: false,
  hasSticker: false,
  hasAudio: false,
  hasVoice: false,
  hasDocument: false,
  hasContact: false,
  hasLocation: false,
  hasPoll: false,
};

const buildCommandUpdate = (
  name: string,
  args: readonly string[] = [],
): TelegramUpdateEnvelope => ({
  updateId: 1,
  kind: "message",
  receivedAt: new Date(0),
  chat: { chatId: -100n, chatType: "supergroup", topicId: undefined },
  user: { userId: 1n, username: "tester", languageCode: "es" },
  command: { name, raw: `/${name}`, args },
  callbackData: undefined,
  messageText: undefined,
  content: emptyContent,
  attachment: undefined,
  preCheckout: undefined,
  successfulPayment: undefined,
  inlineQuery: undefined,
  messageId: 1,
  newChatMemberIds: [],
  isTextMessage: false,
  raw: {},
});

const rssFixture = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item><title>Tercero</title><link>https://e.com/3</link><guid>g3</guid></item>
  <item><title>Segundo</title><link>https://e.com/2</link><guid>g2</guid></item>
  <item><title><![CDATA[Primero & co]]></title><link>https://e.com/1</link><guid>g1</guid></item>
</channel></rss>`;

const atomFixture = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry><title>A</title><id>a1</id><link href="https://e.com/a"/></entry>
</feed>`;

describe("parseRssCommand", () => {
  it("parses add with a valid url", () => {
    expect(
      parseRssCommand(
        buildCommandUpdate("rss", ["add", "https://e.com/feed.xml"]),
      ),
    ).toEqual({
      ok: true,
      command: { kind: "add", url: "https://e.com/feed.xml" },
    });
  });

  it("rejects an invalid url", () => {
    expect(
      parseRssCommand(buildCommandUpdate("rss", ["add", "ftp://x"])),
    ).toMatchObject({ ok: false, error: { code: "url-invalid" } });
  });

  it("parses list and remove", () => {
    expect(parseRssCommand(buildCommandUpdate("rss", ["list"]))).toEqual({
      ok: true,
      command: { kind: "list" },
    });
    expect(
      parseRssCommand(buildCommandUpdate("rss", ["remove", "fd_1"])),
    ).toEqual({ ok: true, command: { kind: "remove", feedId: "fd_1" } });
  });
});

describe("parseFeedItems", () => {
  it("parses RSS items with CDATA and entities", () => {
    const items = parseFeedItems(rssFixture);
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({
      guid: "g3",
      title: "Tercero",
      link: "https://e.com/3",
    });
    expect(items[2]?.title).toBe("Primero & co");
  });

  it("parses Atom entries with href links and id", () => {
    const items = parseFeedItems(atomFixture);
    expect(items[0]).toEqual({
      guid: "a1",
      title: "A",
      link: "https://e.com/a",
    });
  });
});

describe("selectNewItems", () => {
  it("returns items newer than the cursor", () => {
    const items = parseFeedItems(rssFixture);
    expect(selectNewItems(items, "g1").map((i) => i.guid)).toEqual([
      "g3",
      "g2",
    ]);
  });

  it("returns all items when the cursor is unknown", () => {
    const items = parseFeedItems(rssFixture);
    expect(selectNewItems(items, undefined)).toHaveLength(3);
    expect(selectNewItems(items, "missing")).toHaveLength(3);
  });
});
