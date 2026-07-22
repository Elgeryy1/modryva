import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import { parseModerationPlusCommand } from "./moderation-plus.js";

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

const cmd = (name: string, args: string[]) => ({
  name,
  raw: `/${name} ${args.join(" ")}`.trim(),
  args,
});

describe("parseModerationPlusCommand", () => {
  it("parses tban with a week duration", () => {
    const r = parseModerationPlusCommand(
      baseUpdate({ command: cmd("tban", ["123", "2w", "spam"]) }),
    );
    expect(r).toEqual({
      ok: true,
      command: {
        kind: "temp",
        action: "ban",
        targetTelegramUserId: 123n,
        durationMs: 2 * 604_800_000,
        reason: "spam",
      },
    });
  });

  it("parses tmute and requires a duration", () => {
    expect(
      parseModerationPlusCommand(
        baseUpdate({ command: cmd("tmute", ["9", "30m"]) }),
      ),
    ).toMatchObject({
      ok: true,
      command: { action: "mute", durationMs: 1_800_000 },
    });
    expect(
      parseModerationPlusCommand(baseUpdate({ command: cmd("tmute", ["9"]) }))
        ?.ok,
    ).toBe(false);
  });

  it("parses silent ban and silent mute", () => {
    expect(
      parseModerationPlusCommand(
        baseUpdate({ command: cmd("sban", ["9", "toxico"]) }),
      ),
    ).toMatchObject({
      ok: true,
      command: { kind: "silent", action: "ban", durationMs: undefined },
    });
    expect(
      parseModerationPlusCommand(
        baseUpdate({ command: cmd("smute", ["9", "1h"]) }),
      ),
    ).toMatchObject({
      ok: true,
      command: { kind: "silent", action: "mute", durationMs: 3_600_000 },
    });
  });

  it("parses the delete matrix (dban/dmute/dkick)", () => {
    expect(
      parseModerationPlusCommand(
        baseUpdate({ command: cmd("dban", ["9", "flood"]) }),
      ),
    ).toMatchObject({
      ok: true,
      command: { kind: "delete", action: "ban", reason: "flood" },
    });
    expect(
      parseModerationPlusCommand(baseUpdate({ command: cmd("dmute", ["9"]) })),
    ).toMatchObject({ ok: true, command: { kind: "delete", action: "mute" } });
    expect(
      parseModerationPlusCommand(baseUpdate({ command: cmd("dkick", ["9"]) })),
    ).toMatchObject({ ok: true, command: { kind: "delete", action: "kick" } });
  });

  it("parses silent kick without requiring a duration", () => {
    expect(
      parseModerationPlusCommand(
        baseUpdate({ command: cmd("skick", ["9", "adios"]) }),
      ),
    ).toMatchObject({
      ok: true,
      command: {
        kind: "silent",
        action: "kick",
        durationMs: undefined,
        reason: "adios",
      },
    });
  });

  it("errors without a numeric target and returns null for others", () => {
    expect(
      parseModerationPlusCommand(baseUpdate({ command: cmd("tban", ["x"]) }))
        ?.ok,
    ).toBe(false);
    expect(
      parseModerationPlusCommand(baseUpdate({ command: cmd("ban", ["9"]) })),
    ).toBeNull();
  });
});
