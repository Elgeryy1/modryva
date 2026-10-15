import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  formatPollResults,
  parsePollCommand,
  parsePollVote,
  tallyVotes,
} from "./polls.js";

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

describe("parsePollCommand", () => {
  it("parses a question with options", () => {
    expect(
      parsePollCommand(
        buildCommandUpdate("poll", ["Color?", "|", "Rojo", "|", "Azul"]),
      ),
    ).toEqual({
      ok: true,
      command: {
        kind: "create",
        draft: { question: "Color?", options: ["Rojo", "Azul"] },
      },
    });
  });

  it("rejects fewer than two options", () => {
    expect(
      parsePollCommand(buildCommandUpdate("poll", ["Solo", "|", "Una"])),
    ).toMatchObject({ ok: false, error: { code: "format" } });
  });

  it("returns null for other commands", () => {
    expect(parsePollCommand(buildCommandUpdate("ban"))).toBeNull();
  });
});

describe("tallyVotes", () => {
  it("counts votes per option and ignores out-of-range", () => {
    const tally = tallyVotes(
      [
        { optionIndex: 0 },
        { optionIndex: 1 },
        { optionIndex: 0 },
        { optionIndex: 9 },
      ],
      2,
    );
    expect(tally).toEqual([2, 1]);
  });
});

describe("parsePollVote", () => {
  it("parses a valid vote callback", () => {
    expect(parsePollVote("poll:abc:2")).toEqual({
      pollId: "abc",
      optionIndex: 2,
    });
  });

  it("returns null for non-poll callbacks", () => {
    expect(parsePollVote("menu:status")).toBeNull();
    expect(parsePollVote(undefined)).toBeNull();
  });
});

describe("formatPollResults", () => {
  it("renders counts and percentages", () => {
    const text = formatPollResults("Q", ["A", "B"], [3, 1]);
    expect(text).toContain("A: 3 (75%)");
    expect(text).toContain("B: 1 (25%)");
    expect(text).toContain("Total de votos: 4");
  });
});
