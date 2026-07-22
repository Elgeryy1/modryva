import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";
import { parseModerationCommand } from "./moderation-command.js";

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

const updateWithCommand = (
  name: string,
  args: readonly string[],
): TelegramUpdateEnvelope => ({
  updateId: 1,
  kind: "message",
  receivedAt: new Date("2026-01-01T00:00:00.000Z"),
  chat: {
    chatId: -100n,
    chatType: "supergroup",
    topicId: undefined,
  },
  user: {
    userId: 42n,
    username: "gerard",
    languageCode: "es",
  },
  command: {
    name,
    args,
    raw: `/${name} ${args.join(" ")}`,
  },
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

describe("parseModerationCommand", () => {
  it("parses warn commands", () => {
    expect(
      parseModerationCommand(updateWithCommand("warn", ["99", "spam"])),
    ).toEqual({
      ok: true,
      plan: {
        action: "warn",
        targetTelegramUserId: 99n,
        durationMs: undefined,
        reason: "spam",
      },
    });
  });

  it("parses mute duration", () => {
    expect(
      parseModerationCommand(updateWithCommand("mute", ["99", "10m", "flood"])),
    ).toEqual({
      ok: true,
      plan: {
        action: "mute",
        targetTelegramUserId: 99n,
        durationMs: 600_000,
        reason: "flood",
      },
    });
  });

  it("parses revert actions (unban/unmute/kick)", () => {
    for (const action of ["unban", "unmute", "kick"] as const) {
      expect(
        parseModerationCommand(updateWithCommand(action, ["99", "motivo"])),
      ).toEqual({
        ok: true,
        plan: {
          action,
          targetTelegramUserId: 99n,
          durationMs: undefined,
          reason: "motivo",
        },
      });
    }
  });

  it("rejects non numeric targets for persistent moderation", () => {
    expect(
      parseModerationCommand(updateWithCommand("ban", ["@user"])),
    ).toMatchObject({
      ok: false,
      error: { code: "target-id-required" },
    });
  });
});
