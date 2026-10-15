import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  levelForXp,
  parseReputationCommand,
  xpForLevel,
} from "./reputation.js";

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

describe("parseReputationCommand", () => {
  it("parses /rep with a target id", () => {
    expect(parseReputationCommand(buildCommandUpdate("rep", ["99"]))).toEqual({
      ok: true,
      command: { kind: "give", targetTelegramUserId: 99n },
    });
  });

  it("treats /rep without args as self lookup", () => {
    expect(parseReputationCommand(buildCommandUpdate("rep"))).toEqual({
      ok: true,
      command: { kind: "show-self" },
    });
  });

  it("rejects a non-numeric target", () => {
    expect(
      parseReputationCommand(buildCommandUpdate("rep", ["@user"])),
    ).toMatchObject({ ok: false, error: { code: "invalid-target" } });
  });

  it("parses /top and /level", () => {
    expect(parseReputationCommand(buildCommandUpdate("top"))).toEqual({
      ok: true,
      command: { kind: "top" },
    });
    expect(parseReputationCommand(buildCommandUpdate("level"))).toEqual({
      ok: true,
      command: { kind: "level" },
    });
  });
});

describe("levelForXp", () => {
  it("is zero at zero xp", () => {
    expect(levelForXp(0)).toBe(0);
  });

  it("follows the 10*n^2 curve", () => {
    expect(levelForXp(10)).toBe(1);
    expect(levelForXp(40)).toBe(2);
    expect(levelForXp(90)).toBe(3);
    expect(levelForXp(89)).toBe(2);
  });

  it("round-trips with xpForLevel", () => {
    expect(xpForLevel(4)).toBe(160);
    expect(levelForXp(xpForLevel(4))).toBe(4);
  });
});
