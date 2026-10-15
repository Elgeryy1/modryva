import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  dayKeyFromMs,
  parseStatsCommand,
  sumRecentMessages,
} from "./analytics.js";

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

const buildCommandUpdate = (name: string): TelegramUpdateEnvelope => ({
  updateId: 1,
  kind: "message",
  receivedAt: new Date(0),
  chat: { chatId: -100n, chatType: "supergroup", topicId: undefined },
  user: { userId: 1n, username: "tester", languageCode: "es" },
  command: { name, raw: `/${name}`, args: [] },
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

describe("parseStatsCommand", () => {
  it("parses /stats as summary", () => {
    expect(parseStatsCommand(buildCommandUpdate("stats"))).toEqual({
      ok: true,
      command: { kind: "summary" },
    });
  });

  it("parses /activity", () => {
    expect(parseStatsCommand(buildCommandUpdate("activity"))).toEqual({
      ok: true,
      command: { kind: "activity" },
    });
  });

  it("returns null for unrelated commands", () => {
    expect(parseStatsCommand(buildCommandUpdate("ban"))).toBeNull();
  });
});

describe("dayKeyFromMs", () => {
  it("buckets by UTC day", () => {
    expect(dayKeyFromMs(Date.UTC(2026, 5, 28, 23, 59))).toBe("2026-06-28");
    expect(dayKeyFromMs(Date.UTC(2026, 5, 29, 0, 1))).toBe("2026-06-29");
  });
});

describe("sumRecentMessages", () => {
  const today = Date.UTC(2026, 5, 28, 12);

  it("sums only days within the window", () => {
    const windows = [
      { day: "2026-06-28", messages: 5 },
      { day: "2026-06-27", messages: 3 },
      { day: "2026-06-20", messages: 100 },
    ];
    expect(sumRecentMessages(windows, today, 7)).toBe(8);
  });

  it("returns zero with no recent activity", () => {
    expect(
      sumRecentMessages([{ day: "2026-01-01", messages: 9 }], today, 7),
    ).toBe(0);
  });
});
