import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";
import { computeRunAtMs, parseScheduleCommand } from "./scheduling.js";

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

describe("parseScheduleCommand", () => {
  it("parses minutes and message", () => {
    expect(
      parseScheduleCommand(
        buildCommandUpdate("schedule", ["30", "Hola", "grupo"]),
      ),
    ).toEqual({
      ok: true,
      command: { kind: "create", minutes: 30, text: "Hola grupo" },
    });
  });

  it("rejects invalid minutes or empty message", () => {
    expect(
      parseScheduleCommand(buildCommandUpdate("schedule", ["0", "x"])),
    ).toMatchObject({ ok: false, error: { code: "format" } });
    expect(
      parseScheduleCommand(buildCommandUpdate("schedule", ["10"])),
    ).toMatchObject({ ok: false, error: { code: "format" } });
  });

  it("parses list and cancel", () => {
    expect(parseScheduleCommand(buildCommandUpdate("schedules"))).toEqual({
      ok: true,
      command: { kind: "list" },
    });
    expect(
      parseScheduleCommand(buildCommandUpdate("unschedule", ["sp_1"])),
    ).toEqual({ ok: true, command: { kind: "cancel", postId: "sp_1" } });
  });
});

describe("computeRunAtMs", () => {
  it("adds the minutes in milliseconds", () => {
    expect(computeRunAtMs(1_000, 2)).toBe(1_000 + 120_000);
  });
});
