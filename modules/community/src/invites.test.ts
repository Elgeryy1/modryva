import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";
import { countInvitedMembers, parseInviteCommand } from "./invites.js";

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

describe("parseInviteCommand", () => {
  it("parses /invites as self", () => {
    expect(parseInviteCommand(buildCommandUpdate("invites"))).toEqual({
      ok: true,
      command: { kind: "self" },
    });
  });

  it("parses /inviters as top", () => {
    expect(parseInviteCommand(buildCommandUpdate("inviters"))).toEqual({
      ok: true,
      command: { kind: "top" },
    });
  });

  it("returns null for unrelated commands", () => {
    expect(parseInviteCommand(buildCommandUpdate("start"))).toBeNull();
  });
});

describe("countInvitedMembers", () => {
  it("counts members invited by someone else", () => {
    expect(countInvitedMembers(42n, [90n, 91n])).toBe(2);
  });

  it("excludes self-joins", () => {
    expect(countInvitedMembers(90n, [90n])).toBe(0);
    expect(countInvitedMembers(42n, [42n, 91n])).toBe(1);
  });

  it("returns zero when there is no inviter", () => {
    expect(countInvitedMembers(undefined, [90n])).toBe(0);
  });
});
