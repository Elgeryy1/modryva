import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  defaultAntiraidSettings,
  evaluateRaid,
  parseAntiraidCommand,
} from "./antiraid.js";

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

describe("evaluateRaid", () => {
  const settings = {
    ...defaultAntiraidSettings,
    enabled: true,
    windowSeconds: 30,
    joinLimit: 3,
    mode: "enforce" as const,
  };

  it("does not trigger when disabled", () => {
    const decision = evaluateRaid([1, 2, 3, 4, 5], 5_000, {
      ...settings,
      enabled: false,
    });
    expect(decision.triggered).toBe(false);
  });

  it("triggers when joins exceed the limit in the window", () => {
    const now = 10_000;
    const decision = evaluateRaid([7_000, 8_000, 9_000, 10_000], now, settings);
    expect(decision.joinCount).toBe(4);
    expect(decision.triggered).toBe(true);
    expect(decision.mode).toBe("enforce");
  });

  it("ignores joins outside the window", () => {
    const now = 60_000;
    const decision = evaluateRaid(
      [1_000, 2_000, 59_000, 60_000],
      now,
      settings,
    );
    expect(decision.joinCount).toBe(2);
    expect(decision.triggered).toBe(false);
  });
});

describe("parseAntiraidCommand", () => {
  it("returns null for unrelated commands", () => {
    expect(parseAntiraidCommand(buildCommandUpdate("start"))).toBeNull();
  });

  it("parses mode changes", () => {
    expect(
      parseAntiraidCommand(buildCommandUpdate("antiraid_mode", ["enforce"])),
    ).toEqual({ ok: true, command: { kind: "mode", mode: "enforce" } });
  });

  it("rejects an invalid mode", () => {
    expect(
      parseAntiraidCommand(buildCommandUpdate("antiraid_mode", ["nuke"])),
    ).toMatchObject({ ok: false, error: { code: "invalid-mode" } });
  });

  it("parses a valid limit", () => {
    expect(
      parseAntiraidCommand(buildCommandUpdate("antiraid_limit", ["8", "20"])),
    ).toEqual({
      ok: true,
      command: { kind: "limit", joinLimit: 8, windowSeconds: 20 },
    });
  });
});
