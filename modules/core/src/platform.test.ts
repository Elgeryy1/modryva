import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import { parsePlatformCommand } from "./platform.js";

const updateWithCommand = (
  name: string,
  args: readonly string[] = [],
): TelegramUpdateEnvelope =>
  ({
    updateId: 1,
    kind: "message",
    receivedAt: new Date(0),
    chat: { chatId: 1n, chatType: "private", topicId: undefined },
    user: { userId: 42n, username: "owner", languageCode: undefined },
    command: { name, raw: `/${name}`, args },
    callbackData: undefined,
    messageText: `/${name}`,
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
    messageId: 1,
    newChatMemberIds: [],
    isTextMessage: false,
    raw: {},
  }) satisfies TelegramUpdateEnvelope;

describe("parsePlatformCommand", () => {
  it("parses the platform panel shortcut", () => {
    expect(parsePlatformCommand(updateWithCommand("platform"))).toEqual({
      ok: true,
      command: { kind: "platform-panel" },
    });
  });

  it("parses promo and admin commands", () => {
    expect(
      parsePlatformCommand(
        updateWithCommand("promo_create", ["creator", "5", "30d", "beta"]),
      ),
    ).toEqual({
      ok: true,
      command: {
        kind: "promo-create",
        template: "creator",
        maxUses: 5,
        expiresInDays: 30,
        note: "beta",
      },
    });

    expect(
      parsePlatformCommand(
        updateWithCommand("platform_admin", ["add", "123", "promo_admin"]),
      ),
    ).toEqual({
      ok: true,
      command: {
        kind: "platform-admin-add",
        target: "123",
        role: "promo_admin",
      },
    });
  });

  it("parses redemption and custom bot grants", () => {
    expect(
      parsePlatformCommand(updateWithCommand("redeem", ["sb-abc12345"])),
    ).toEqual({
      ok: true,
      command: { kind: "redeem", code: "SB-ABC12345" },
    });

    expect(
      parsePlatformCommand(
        updateWithCommand("grant_custombot", ["@pepe", "business", "90"]),
      ),
    ).toEqual({
      ok: true,
      command: {
        kind: "grant-custombot",
        target: "@pepe",
        template: "business",
        expiresInDays: 90,
      },
    });
  });
});
