import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import { buildIdGroupReply } from "./id-group.js";

const baseUpdate = (
  overrides: Partial<TelegramUpdateEnvelope> = {},
): TelegramUpdateEnvelope => ({
  updateId: 1,
  kind: "message",
  receivedAt: new Date("2026-01-01T00:00:00Z"),
  chat: { chatId: 100n, chatType: "supergroup", topicId: undefined },
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

const cmd = (name: string): TelegramUpdateEnvelope =>
  baseUpdate({ command: { name, raw: `/${name}`, args: [] } });

describe("buildIdGroupReply", () => {
  it("returns null when the command is not /idgroup", () => {
    expect(buildIdGroupReply(baseUpdate())).toBeNull();
    expect(buildIdGroupReply(cmd("ban"))).toBeNull();
  });

  it("reports the chat id for a supergroup", () => {
    expect(buildIdGroupReply(cmd("idgroup"))).toEqual({
      text: "🆔 ID de este supergroup: 100",
    });
  });

  it("labels a private chat as 'chat privado'", () => {
    const update = baseUpdate({
      command: { name: "idgroup", raw: "/idgroup", args: [] },
      chat: { chatId: -42n, chatType: "private", topicId: undefined },
    });
    expect(buildIdGroupReply(update)).toEqual({
      text: "🆔 ID de este chat privado: -42",
    });
  });

  it("falls back to 'chat' when the chat type is missing", () => {
    const update = baseUpdate({
      command: { name: "idgroup", raw: "/idgroup", args: [] },
      chat: { chatId: 500n, chatType: undefined, topicId: undefined },
    });
    expect(buildIdGroupReply(update)).toEqual({
      text: "🆔 ID de este chat: 500",
    });
  });

  it("returns an error message when the chat id cannot be read", () => {
    const update = baseUpdate({
      command: { name: "idgroup", raw: "/idgroup", args: [] },
      chat: { chatId: undefined, chatType: "group", topicId: undefined },
    });
    expect(buildIdGroupReply(update)).toEqual({
      text: "No he podido leer el ID de este chat.",
    });
  });
});
