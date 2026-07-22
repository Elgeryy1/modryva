import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  type BotBehaviorFlags,
  hourFromMs,
  isNightTime,
  isServiceMessage,
  type NightWindow,
  parseHygieneCommand,
  resolveBotMode,
} from "./group-hygiene.js";

const baseUpdate = (
  o: Partial<TelegramUpdateEnvelope> = {},
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
  ...o,
});

const cmd = (name: string, args: readonly string[]) => ({
  name,
  raw: `/${name} ${args.join(" ")}`,
  args,
});

describe("parseHygieneCommand", () => {
  it("returns null when the command is not a hygiene command", () => {
    expect(
      parseHygieneCommand(baseUpdate({ command: cmd("ban", []) })),
    ).toBeNull();
  });

  it("returns null when there is no command", () => {
    expect(parseHygieneCommand(baseUpdate())).toBeNull();
  });

  it("parses /cleanservice on", () => {
    expect(
      parseHygieneCommand(baseUpdate({ command: cmd("cleanservice", ["on"]) })),
    ).toEqual({ ok: true, command: { kind: "cleanservice", enabled: true } });
  });

  it("parses /cleanservice off", () => {
    expect(
      parseHygieneCommand(
        baseUpdate({ command: cmd("cleanservice", ["off"]) }),
      ),
    ).toEqual({ ok: true, command: { kind: "cleanservice", enabled: false } });
  });

  it("parses /cleanwelcome si as enabled", () => {
    expect(
      parseHygieneCommand(baseUpdate({ command: cmd("cleanwelcome", ["si"]) })),
    ).toEqual({ ok: true, command: { kind: "cleanwelcome", enabled: true } });
  });

  it("parses /cleanwelcome no as disabled", () => {
    expect(
      parseHygieneCommand(baseUpdate({ command: cmd("cleanwelcome", ["no"]) })),
    ).toEqual({ ok: true, command: { kind: "cleanwelcome", enabled: false } });
  });

  it("parses /nightmode TRUE case-insensitively", () => {
    expect(
      parseHygieneCommand(baseUpdate({ command: cmd("nightmode", ["TRUE"]) })),
    ).toEqual({ ok: true, command: { kind: "nightmode", enabled: true } });
  });

  it("parses /nightmode false as disabled", () => {
    expect(
      parseHygieneCommand(baseUpdate({ command: cmd("nightmode", ["false"]) })),
    ).toEqual({ ok: true, command: { kind: "nightmode", enabled: false } });
  });

  it("rejects an invalid toggle value", () => {
    expect(
      parseHygieneCommand(
        baseUpdate({ command: cmd("cleanservice", ["maybe"]) }),
      ),
    ).toMatchObject({ ok: false, error: { code: "invalid-toggle" } });
  });

  it("rejects a missing toggle value", () => {
    expect(
      parseHygieneCommand(baseUpdate({ command: cmd("nightmode", []) })),
    ).toMatchObject({ ok: false, error: { code: "invalid-toggle" } });
  });

  it("parses /setnight 23 7", () => {
    expect(
      parseHygieneCommand(
        baseUpdate({ command: cmd("setnight", ["23", "7"]) }),
      ),
    ).toEqual({
      ok: true,
      command: { kind: "setnight", startHour: 23, endHour: 7 },
    });
  });

  it("parses /setnight 0 0 edge hours", () => {
    expect(
      parseHygieneCommand(baseUpdate({ command: cmd("setnight", ["0", "0"]) })),
    ).toEqual({
      ok: true,
      command: { kind: "setnight", startHour: 0, endHour: 0 },
    });
  });

  it("rejects /setnight with an out-of-range hour", () => {
    expect(
      parseHygieneCommand(
        baseUpdate({ command: cmd("setnight", ["24", "7"]) }),
      ),
    ).toMatchObject({ ok: false, error: { code: "invalid-hours" } });
  });

  it("rejects /setnight with a negative hour", () => {
    expect(
      parseHygieneCommand(
        baseUpdate({ command: cmd("setnight", ["-1", "7"]) }),
      ),
    ).toMatchObject({ ok: false, error: { code: "invalid-hours" } });
  });

  it("rejects /setnight with an incomplete argument list", () => {
    expect(
      parseHygieneCommand(baseUpdate({ command: cmd("setnight", ["23"]) })),
    ).toMatchObject({ ok: false, error: { code: "invalid-hours" } });
  });
});

describe("isServiceMessage", () => {
  it("detects new_chat_members", () => {
    expect(
      isServiceMessage({ message: { new_chat_members: [{ id: 1 }] } }),
    ).toBe(true);
  });

  it("detects left_chat_member", () => {
    expect(isServiceMessage({ message: { left_chat_member: { id: 1 } } })).toBe(
      true,
    );
  });

  it("detects new_chat_title", () => {
    expect(isServiceMessage({ message: { new_chat_title: "Nuevo" } })).toBe(
      true,
    );
  });

  it("detects new_chat_photo", () => {
    expect(isServiceMessage({ message: { new_chat_photo: [] } })).toBe(true);
  });

  it("detects delete_chat_photo", () => {
    expect(isServiceMessage({ message: { delete_chat_photo: true } })).toBe(
      true,
    );
  });

  it("detects group_chat_created", () => {
    expect(isServiceMessage({ message: { group_chat_created: true } })).toBe(
      true,
    );
  });

  it("detects pinned_message", () => {
    expect(
      isServiceMessage({ message: { pinned_message: { message_id: 9 } } }),
    ).toBe(true);
  });

  it("returns false for a normal text message", () => {
    expect(isServiceMessage({ message: { text: "hola" } })).toBe(false);
  });

  it("returns false when raw is null", () => {
    expect(isServiceMessage(null)).toBe(false);
  });

  it("returns false when raw is not an object", () => {
    expect(isServiceMessage("new_chat_members")).toBe(false);
  });

  it("returns false when message is missing", () => {
    expect(isServiceMessage({ update_id: 1 })).toBe(false);
  });

  it("returns false when message is not an object", () => {
    expect(isServiceMessage({ message: 42 })).toBe(false);
  });
});

describe("isNightTime", () => {
  const normal: NightWindow = { startHour: 1, endHour: 6 };
  const crossing: NightWindow = { startHour: 23, endHour: 7 };

  it("is night inside a normal window", () => {
    expect(isNightTime(3, normal)).toBe(true);
  });

  it("is not night outside a normal window", () => {
    expect(isNightTime(12, normal)).toBe(false);
  });

  it("includes the start hour (inclusive)", () => {
    expect(isNightTime(1, normal)).toBe(true);
  });

  it("excludes the end hour (exclusive)", () => {
    expect(isNightTime(6, normal)).toBe(false);
  });

  it("is night before midnight in a crossing window", () => {
    expect(isNightTime(23, crossing)).toBe(true);
  });

  it("is night after midnight in a crossing window", () => {
    expect(isNightTime(2, crossing)).toBe(true);
  });

  it("is not night in the daytime gap of a crossing window", () => {
    expect(isNightTime(7, crossing)).toBe(false);
  });

  it("treats an empty window (start === end) as never night", () => {
    expect(isNightTime(5, { startHour: 5, endHour: 5 })).toBe(false);
  });
});

describe("hourFromMs", () => {
  const midnightUtc = Date.parse("2026-01-01T00:00:00Z");

  it("returns the UTC hour with a zero offset", () => {
    expect(hourFromMs(Date.parse("2026-01-01T15:30:00Z"), 0)).toBe(15);
  });

  it("applies a positive offset", () => {
    expect(hourFromMs(midnightUtc, 120)).toBe(2);
  });

  it("applies a negative offset and wraps to the previous day", () => {
    expect(hourFromMs(midnightUtc, -60)).toBe(23);
  });

  it("wraps across the day boundary with a positive offset", () => {
    expect(hourFromMs(Date.parse("2026-01-01T23:00:00Z"), 120)).toBe(1);
  });
});

describe("resolveBotMode", () => {
  const flags = (o: Partial<BotBehaviorFlags> = {}): BotBehaviorFlags => ({
    passiveMode: false,
    autoModeration: true,
    autoCleanup: true,
    autoMessages: true,
    ...o,
  });

  it("runs everything when passive is off and all categories are on", () => {
    expect(resolveBotMode(flags())).toEqual({
      moderation: true,
      cleanup: true,
      messages: true,
      commands: true,
    });
  });

  it("passive mode silences everything, including commands", () => {
    // Even with every category explicitly on, the master switch wins.
    expect(
      resolveBotMode(
        flags({
          passiveMode: true,
          autoModeration: true,
          autoCleanup: true,
          autoMessages: true,
        }),
      ),
    ).toEqual({
      moderation: false,
      cleanup: false,
      messages: false,
      commands: false,
    });
  });

  it("a category toggle disables only its own autonomous behaviour, never commands", () => {
    expect(resolveBotMode(flags({ autoModeration: false }))).toEqual({
      moderation: false,
      cleanup: true,
      messages: true,
      commands: true,
    });
    expect(resolveBotMode(flags({ autoCleanup: false }))).toEqual({
      moderation: true,
      cleanup: false,
      messages: true,
      commands: true,
    });
    expect(resolveBotMode(flags({ autoMessages: false }))).toEqual({
      moderation: true,
      cleanup: true,
      messages: false,
      commands: true,
    });
  });
});
