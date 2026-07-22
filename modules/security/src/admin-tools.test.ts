import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  type ChatAdmin,
  extractReplyContext,
  formatAdminList,
  parseAdminToolCommand,
} from "./admin-tools.js";

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

const cmd = (
  name: string,
  args: readonly string[] = [],
): NonNullable<TelegramUpdateEnvelope["command"]> => ({
  name,
  raw: `/${name} ${args.join(" ")}`.trim(),
  args,
});

const replyRaw = (
  messageId: number,
  from?: { id?: unknown; username?: string },
): unknown => ({
  message: {
    reply_to_message: {
      message_id: messageId,
      ...(from ? { from } : {}),
    },
  },
});

const admin = (overrides: Partial<ChatAdmin> = {}): ChatAdmin => ({
  userId: 1n,
  username: undefined,
  firstName: undefined,
  isOwner: false,
  customTitle: undefined,
  ...overrides,
});

describe("extractReplyContext", () => {
  it("extracts message id, user id and username from a full raw update", () => {
    const raw = replyRaw(42, { id: 99, username: "bob" });
    expect(extractReplyContext(raw)).toEqual({
      messageId: 42,
      userId: 99n,
      username: "bob",
    });
  });

  it("handles a reply without from", () => {
    expect(extractReplyContext(replyRaw(42))).toEqual({
      messageId: 42,
      userId: undefined,
      username: undefined,
    });
  });

  it("handles a from without username", () => {
    expect(extractReplyContext(replyRaw(42, { id: 99 }))).toEqual({
      messageId: 42,
      userId: 99n,
      username: undefined,
    });
  });

  it("returns all undefined for an empty object", () => {
    expect(extractReplyContext({})).toEqual({
      messageId: undefined,
      userId: undefined,
      username: undefined,
    });
  });

  it("returns all undefined for null, undefined and primitives", () => {
    for (const raw of [null, undefined, "hola", 42, true]) {
      expect(extractReplyContext(raw)).toEqual({
        messageId: undefined,
        userId: undefined,
        username: undefined,
      });
    }
  });

  it("ignores fields with unexpected types", () => {
    const raw = {
      message: {
        reply_to_message: {
          message_id: "42",
          from: { id: "no-numerico", username: 5 },
        },
      },
    };
    expect(extractReplyContext(raw)).toEqual({
      messageId: undefined,
      userId: undefined,
      username: undefined,
    });
  });
});

describe("parseAdminToolCommand", () => {
  it("returns null for unrelated or missing commands", () => {
    expect(parseAdminToolCommand(baseUpdate())).toBeNull();
    expect(
      parseAdminToolCommand(baseUpdate({ command: cmd("quiz", ["a | b"]) })),
    ).toBeNull();
  });

  it("parses /pin when replying to a message", () => {
    const update = baseUpdate({ command: cmd("pin"), raw: replyRaw(42) });
    expect(parseAdminToolCommand(update)).toEqual({
      ok: true,
      command: { kind: "pin", messageId: 42 },
    });
  });

  it("rejects /pin without reply", () => {
    expect(parseAdminToolCommand(baseUpdate({ command: cmd("pin") }))).toEqual({
      ok: false,
      error: { code: "format", usage: "Responde a un mensaje con /pin" },
    });
  });

  it("parses /unpin", () => {
    expect(
      parseAdminToolCommand(baseUpdate({ command: cmd("unpin") })),
    ).toEqual({ ok: true, command: { kind: "unpin" } });
  });

  it("parses /del when replying and rejects it without reply", () => {
    const withReply = baseUpdate({ command: cmd("del"), raw: replyRaw(77) });
    expect(parseAdminToolCommand(withReply)).toEqual({
      ok: true,
      command: { kind: "del", messageId: 77 },
    });
    expect(
      parseAdminToolCommand(baseUpdate({ command: cmd("del") })),
    ).toMatchObject({
      ok: false,
      error: { code: "format", usage: "Responde a un mensaje con /del" },
    });
  });

  it("parses /settitle with text and rejects empty or too long titles", () => {
    expect(
      parseAdminToolCommand(
        baseUpdate({ command: cmd("settitle", ["Grupo", "genial"]) }),
      ),
    ).toEqual({
      ok: true,
      command: { kind: "settitle", title: "Grupo genial" },
    });
    expect(
      parseAdminToolCommand(baseUpdate({ command: cmd("settitle") })),
    ).toMatchObject({ ok: false, error: { code: "format" } });
    expect(
      parseAdminToolCommand(
        baseUpdate({ command: cmd("settitle", ["x".repeat(129)]) }),
      ),
    ).toMatchObject({ ok: false, error: { code: "format" } });
  });

  it("parses /setdesc with text and rejects empty or too long descriptions", () => {
    expect(
      parseAdminToolCommand(
        baseUpdate({ command: cmd("setdesc", ["Reglas", "del", "grupo"]) }),
      ),
    ).toEqual({
      ok: true,
      command: { kind: "setdesc", description: "Reglas del grupo" },
    });
    expect(
      parseAdminToolCommand(baseUpdate({ command: cmd("setdesc") })),
    ).toMatchObject({ ok: false, error: { code: "format" } });
    expect(
      parseAdminToolCommand(
        baseUpdate({ command: cmd("setdesc", ["x".repeat(256)]) }),
      ),
    ).toMatchObject({ ok: false, error: { code: "format" } });
  });

  it("parses /promote via reply using all args as title", () => {
    const update = baseUpdate({
      command: cmd("promote", ["Super", "Mod"]),
      raw: replyRaw(1, { id: 99, username: "bob" }),
    });
    expect(parseAdminToolCommand(update)).toEqual({
      ok: true,
      command: { kind: "promote", userId: 99n, title: "Super Mod" },
    });
  });

  it("parses /promote by numeric id without title", () => {
    expect(
      parseAdminToolCommand(baseUpdate({ command: cmd("promote", ["123"]) })),
    ).toEqual({
      ok: true,
      command: { kind: "promote", userId: 123n, title: undefined },
    });
  });

  it("trims the promote title to 16 characters", () => {
    const update = baseUpdate({
      command: cmd("promote", ["123", "Moderador", "Supremo", "Total"]),
    });
    expect(parseAdminToolCommand(update)).toEqual({
      ok: true,
      command: {
        kind: "promote",
        userId: 123n,
        title: "Moderador Suprem",
      },
    });
  });

  it("rejects /promote without target", () => {
    expect(
      parseAdminToolCommand(baseUpdate({ command: cmd("promote") })),
    ).toMatchObject({ ok: false, error: { code: "format" } });
    expect(
      parseAdminToolCommand(baseUpdate({ command: cmd("promote", ["@pepe"]) })),
    ).toMatchObject({ ok: false, error: { code: "format" } });
  });

  it("parses /demote via reply, by id, and rejects it without target", () => {
    expect(
      parseAdminToolCommand(
        baseUpdate({ command: cmd("demote"), raw: replyRaw(1, { id: 99 }) }),
      ),
    ).toEqual({ ok: true, command: { kind: "demote", userId: 99n } });
    expect(
      parseAdminToolCommand(baseUpdate({ command: cmd("demote", ["55"]) })),
    ).toEqual({ ok: true, command: { kind: "demote", userId: 55n } });
    expect(
      parseAdminToolCommand(baseUpdate({ command: cmd("demote") })),
    ).toMatchObject({ ok: false, error: { code: "format" } });
  });

  it("parses /invitelink and /admins", () => {
    expect(
      parseAdminToolCommand(baseUpdate({ command: cmd("invitelink") })),
    ).toEqual({ ok: true, command: { kind: "invitelink" } });
    expect(
      parseAdminToolCommand(baseUpdate({ command: cmd("admins") })),
    ).toEqual({ ok: true, command: { kind: "admins" } });
  });
});

describe("formatAdminList", () => {
  it("returns a fallback message for an empty list", () => {
    expect(formatAdminList([])).toBe(
      "No pude obtener la lista de administradores.",
    );
  });

  it("marks only the owner with a crown and shows custom titles", () => {
    const text = formatAdminList([
      admin({
        userId: 1n,
        firstName: "Ana",
        username: "ana",
        isOwner: true,
        customTitle: "Fundadora",
      }),
      admin({ userId: 2n, firstName: "Luis", username: "luis" }),
    ]);
    expect(text).toBe(
      [
        "\u{1F46E} Administradores del grupo:",
        "• \u{1F451} Ana (@ana) — Fundadora",
        "• Luis (@luis)",
      ].join("\n"),
    );
  });

  it("omits the username part when the admin has no username", () => {
    const text = formatAdminList([
      admin({ userId: 3n, firstName: "Sin Alias" }),
    ]);
    expect(text).toContain("• Sin Alias");
    expect(text).not.toContain("(@");
  });

  it("falls back to the user id when there is no name at all", () => {
    const text = formatAdminList([admin({ userId: 9n })]);
    expect(text).toContain("• Usuario 9");
  });
});
