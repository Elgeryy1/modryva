import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";
import { parseTicketCommand } from "./tickets.js";

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

describe("parseTicketCommand", () => {
  it("creates a ticket with default priority", () => {
    expect(
      parseTicketCommand(buildCommandUpdate("ticket", ["No", "funciona"])),
    ).toEqual({
      ok: true,
      command: { kind: "create", subject: "No funciona", priority: "normal" },
    });
  });

  it("reads a leading priority token", () => {
    expect(
      parseTicketCommand(buildCommandUpdate("ticket", ["urgent", "Caido"])),
    ).toEqual({
      ok: true,
      command: { kind: "create", subject: "Caido", priority: "urgent" },
    });
  });

  it("requires a subject", () => {
    expect(parseTicketCommand(buildCommandUpdate("ticket"))).toMatchObject({
      ok: false,
      error: { code: "subject-required" },
    });
  });

  it("parses list, close and reopen", () => {
    expect(parseTicketCommand(buildCommandUpdate("tickets"))).toEqual({
      ok: true,
      command: { kind: "list" },
    });
    expect(
      parseTicketCommand(buildCommandUpdate("ticketclose", ["tk_1"])),
    ).toEqual({ ok: true, command: { kind: "close", ticketId: "tk_1" } });
    expect(
      parseTicketCommand(buildCommandUpdate("ticketreopen", ["tk_1"])),
    ).toEqual({ ok: true, command: { kind: "reopen", ticketId: "tk_1" } });
  });

  it("parses assign with an assignee id", () => {
    expect(
      parseTicketCommand(buildCommandUpdate("ticketassign", ["tk_1", "99"])),
    ).toEqual({
      ok: true,
      command: { kind: "assign", ticketId: "tk_1", assigneeTelegramId: 99n },
    });
  });

  it("requires an assignee id", () => {
    expect(
      parseTicketCommand(buildCommandUpdate("ticketassign", ["tk_1"])),
    ).toMatchObject({ ok: false, error: { code: "assignee-required" } });
  });
});
