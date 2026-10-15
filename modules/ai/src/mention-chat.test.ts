import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import { extractMentionPrompt } from "./mention-chat.js";

const baseUpdate = (
  overrides: Partial<TelegramUpdateEnvelope> = {},
): TelegramUpdateEnvelope => ({
  updateId: 1,
  kind: "message",
  receivedAt: new Date("2026-01-01T00:00:00Z"),
  chat: { chatId: -100n, chatType: "supergroup", topicId: undefined },
  user: { userId: 7n, username: "tester", languageCode: "es" },
  command: undefined,
  callbackData: undefined,
  messageText: undefined,
  content: {
    hasText: true,
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
  },
  attachment: undefined,
  preCheckout: undefined,
  successfulPayment: undefined,
  inlineQuery: undefined,
  messageId: 555,
  newChatMemberIds: [],
  isTextMessage: true,
  raw: {},
  ...overrides,
});

const groupText = (
  text: string,
  overrides: Partial<TelegramUpdateEnvelope> = {},
): TelegramUpdateEnvelope => baseUpdate({ messageText: text, ...overrides });

const cmd = (name: string): TelegramUpdateEnvelope["command"] => ({
  name,
  raw: `/${name}`,
  args: [],
});

describe("extractMentionPrompt", () => {
  it("extracts the question after the mention", () => {
    expect(
      extractMentionPrompt(groupText("@modryvabot que tal"), "modryvabot"),
    ).toBe("que tal");
  });

  it("is case-insensitive for the bot username", () => {
    expect(
      extractMentionPrompt(groupText("@ModryvaBot Que tal?"), "modryvabot"),
    ).toBe("Que tal?");
  });

  it("accepts a botUsername with a leading @", () => {
    expect(
      extractMentionPrompt(groupText("@modryvabot hola"), "@modryvabot"),
    ).toBe("hola");
  });

  it("works when the mention is not at the start", () => {
    expect(
      extractMentionPrompt(groupText("oye @modryvabot que tal"), "modryvabot"),
    ).toBe("oye que tal");
  });

  it("returns undefined when the bot is not mentioned", () => {
    expect(
      extractMentionPrompt(groupText("hola a todos"), "modryvabot"),
    ).toBeUndefined();
  });

  it("returns undefined when a DIFFERENT user is mentioned", () => {
    expect(
      extractMentionPrompt(groupText("@otrobot que tal"), "modryvabot"),
    ).toBeUndefined();
  });

  it("returns undefined when nothing is left after stripping the mention", () => {
    expect(
      extractMentionPrompt(groupText("@modryvabot"), "modryvabot"),
    ).toBeUndefined();
  });

  it("returns undefined outside group/supergroup chats", () => {
    expect(
      extractMentionPrompt(
        groupText("@modryvabot hola", {
          chat: { chatId: 1n, chatType: "private", topicId: undefined },
        }),
        "modryvabot",
      ),
    ).toBeUndefined();
    expect(
      extractMentionPrompt(
        groupText("@modryvabot hola", { kind: "guest_message" }),
        "modryvabot",
      ),
    ).toBeUndefined();
  });

  it("returns undefined when the message already parsed as a command", () => {
    expect(
      extractMentionPrompt(
        groupText("/ai @modryvabot hola", { command: cmd("ai") }),
        "modryvabot",
      ),
    ).toBeUndefined();
  });

  it("returns undefined for a non-message update kind", () => {
    expect(
      extractMentionPrompt(
        groupText("@modryvabot hola", { kind: "callback_query" }),
        "modryvabot",
      ),
    ).toBeUndefined();
  });

  it("returns undefined when there is no text", () => {
    expect(extractMentionPrompt(groupText(""), "modryvabot")).toBeUndefined();
  });
});
