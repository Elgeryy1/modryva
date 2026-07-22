import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";

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

import {
  defaultAntifloodSettings,
  evaluateFlood,
  parseAntifloodCommand,
} from "./antiflood.js";

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

describe("evaluateFlood", () => {
  const settings = {
    ...defaultAntifloodSettings,
    enabled: true,
    windowSeconds: 10,
    messageLimit: 3,
    action: "mute" as const,
  };

  it("does not trigger when disabled", () => {
    const decision = evaluateFlood([1, 2, 3, 4, 5], 5_000, {
      ...settings,
      enabled: false,
    });

    expect(decision.triggered).toBe(false);
    expect(decision.action).toBe("ignore");
  });

  it("does not trigger inside the limit", () => {
    const now = 10_000;
    const decision = evaluateFlood([8_000, 9_000, 10_000], now, settings);

    expect(decision.count).toBe(3);
    expect(decision.triggered).toBe(false);
  });

  it("triggers the configured action when the limit is exceeded", () => {
    const now = 10_000;
    const decision = evaluateFlood(
      [7_000, 8_000, 9_000, 10_000],
      now,
      settings,
    );

    expect(decision.count).toBe(4);
    expect(decision.triggered).toBe(true);
    expect(decision.action).toBe("mute");
  });

  it("ignores timestamps outside the rolling window", () => {
    const now = 30_000;
    const decision = evaluateFlood(
      [1_000, 2_000, 3_000, 29_500, 30_000],
      now,
      settings,
    );

    expect(decision.count).toBe(2);
    expect(decision.triggered).toBe(false);
  });
});

describe("parseAntifloodCommand", () => {
  it("returns null for unrelated commands", () => {
    expect(parseAntifloodCommand(buildCommandUpdate("start"))).toBeNull();
  });

  it("parses enable and disable", () => {
    expect(parseAntifloodCommand(buildCommandUpdate("antiflood_on"))).toEqual({
      ok: true,
      command: { kind: "enable", enabled: true },
    });
    expect(parseAntifloodCommand(buildCommandUpdate("antiflood_off"))).toEqual({
      ok: true,
      command: { kind: "enable", enabled: false },
    });
  });

  it("parses a valid limit with optional window", () => {
    expect(
      parseAntifloodCommand(buildCommandUpdate("antiflood_limit", ["6", "15"])),
    ).toEqual({
      ok: true,
      command: { kind: "limit", messageLimit: 6, windowSeconds: 15 },
    });
  });

  it("rejects an invalid limit", () => {
    const result = parseAntifloodCommand(
      buildCommandUpdate("antiflood_limit", ["0"]),
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid-limit" },
    });
  });

  it("rejects an invalid action", () => {
    const result = parseAntifloodCommand(
      buildCommandUpdate("antiflood_action", ["nuke"]),
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid-action" },
    });
  });
});
