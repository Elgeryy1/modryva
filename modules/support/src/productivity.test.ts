import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  parseReminderCommand,
  parseTaskCommand,
  reminderRunAtMs,
} from "./productivity.js";

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

describe("parseReminderCommand", () => {
  it("parses minutes and text", () => {
    expect(
      parseReminderCommand(buildCommandUpdate("remind", ["15", "Llamar"])),
    ).toEqual({
      ok: true,
      command: { kind: "create", minutes: 15, text: "Llamar" },
    });
  });

  it("rejects invalid input", () => {
    expect(
      parseReminderCommand(buildCommandUpdate("remind", ["0", "x"])),
    ).toMatchObject({ ok: false, error: { code: "format" } });
  });

  it("parses list and cancel", () => {
    expect(parseReminderCommand(buildCommandUpdate("reminders"))).toEqual({
      ok: true,
      command: { kind: "list" },
    });
    expect(
      parseReminderCommand(buildCommandUpdate("unremind", ["rm_1"])),
    ).toEqual({ ok: true, command: { kind: "cancel", reminderId: "rm_1" } });
  });
});

describe("parseTaskCommand", () => {
  it("creates a task", () => {
    expect(
      parseTaskCommand(buildCommandUpdate("task", ["Revisar", "PR"])),
    ).toEqual({ ok: true, command: { kind: "create", title: "Revisar PR" } });
  });

  it("requires a title", () => {
    expect(parseTaskCommand(buildCommandUpdate("task"))).toMatchObject({
      ok: false,
      error: { code: "title-required" },
    });
  });

  it("parses list and done", () => {
    expect(parseTaskCommand(buildCommandUpdate("tasks"))).toEqual({
      ok: true,
      command: { kind: "list" },
    });
    expect(parseTaskCommand(buildCommandUpdate("taskdone", ["ts_1"]))).toEqual({
      ok: true,
      command: { kind: "done", taskId: "ts_1" },
    });
  });
});

describe("reminderRunAtMs", () => {
  it("adds the minutes", () => {
    expect(reminderRunAtMs(1_000, 3)).toBe(1_000 + 180_000);
  });
});
