import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  buildQuotePayload,
  DEFAULT_QUOTE_BACKGROUND,
  extractQuoteSource,
  parseQuoteCommand,
  resolveQuoteColor,
} from "./quotes.js";

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

describe("parseQuoteCommand", () => {
  it("parses bare /q with defaults", () => {
    const result = parseQuoteCommand(baseUpdate({ command: cmd("q", []) }));
    expect(result).toEqual({
      ok: true,
      command: { format: "webp", color: undefined },
    });
  });

  it("accepts the /quote and /quot aliases", () => {
    expect(
      parseQuoteCommand(baseUpdate({ command: cmd("quote", []) })),
    ).not.toBeNull();
    expect(
      parseQuoteCommand(baseUpdate({ command: cmd("quot", []) })),
    ).not.toBeNull();
  });

  it("selects png format", () => {
    const result = parseQuoteCommand(
      baseUpdate({ command: cmd("q", ["png"]) }),
    );
    expect(result?.command.format).toBe("png");
  });

  it("resolves a named colour and a hex colour regardless of order", () => {
    expect(
      parseQuoteCommand(baseUpdate({ command: cmd("q", ["rojo"]) }))?.command
        .color,
    ).toBe("#e0245e");
    expect(
      parseQuoteCommand(baseUpdate({ command: cmd("q", ["png", "1da1f2"]) }))
        ?.command.color,
    ).toBe("#1da1f2");
  });

  it("returns null for a foreign command", () => {
    expect(
      parseQuoteCommand(baseUpdate({ command: cmd("ban", []) })),
    ).toBeNull();
    expect(parseQuoteCommand(baseUpdate())).toBeNull();
  });
});

describe("resolveQuoteColor", () => {
  it("accepts hex with and without hash", () => {
    expect(resolveQuoteColor("#abcdef")).toBe("#abcdef");
    expect(resolveQuoteColor("ABCDEF")).toBe("#abcdef");
  });

  it("maps named colours", () => {
    expect(resolveQuoteColor("verde")).toBe("#17bf63");
    expect(resolveQuoteColor("blue")).toBe("#1da1f2");
  });

  it("returns undefined for unknown and empty", () => {
    expect(resolveQuoteColor("banana")).toBeUndefined();
    expect(resolveQuoteColor(undefined)).toBeUndefined();
    expect(resolveQuoteColor("12345")).toBeUndefined();
  });
});

describe("extractQuoteSource", () => {
  const rawWithReply = (reply: unknown): unknown => ({
    message: { message_id: 2, reply_to_message: reply },
  });

  it("extracts author name and text from a reply", () => {
    const source = extractQuoteSource(
      rawWithReply({
        text: "Hola mundo",
        from: {
          id: 42,
          first_name: "Ada",
          last_name: "Lovelace",
          username: "ada",
        },
      }),
    );
    expect(source).toEqual({
      fromId: 42,
      name: "Ada Lovelace",
      username: "ada",
      text: "Hola mundo",
    });
  });

  it("falls back to caption and a single name", () => {
    const source = extractQuoteSource(
      rawWithReply({
        caption: "pie de foto",
        from: { id: 7, first_name: "Bob" },
      }),
    );
    expect(source?.text).toBe("pie de foto");
    expect(source?.name).toBe("Bob");
    expect(source?.username).toBeUndefined();
  });

  it("returns null without a reply, without text, or with bad shapes", () => {
    expect(extractQuoteSource({ message: { message_id: 1 } })).toBeNull();
    expect(
      extractQuoteSource(rawWithReply({ from: { id: 1, first_name: "X" } })),
    ).toBeNull();
    expect(
      extractQuoteSource(rawWithReply({ text: "hi", from: {} })),
    ).toBeNull();
    expect(extractQuoteSource(null)).toBeNull();
    expect(extractQuoteSource("nope")).toBeNull();
  });

  it("uses a fallback name when the author has no first name", () => {
    const source = extractQuoteSource(
      rawWithReply({ text: "hey", from: { id: 9 } }),
    );
    expect(source?.name).toBe("Anonimo");
  });
});

describe("buildQuotePayload", () => {
  const source = {
    fromId: 42,
    name: "Ada",
    username: "ada",
    text: "Hola",
  };

  it("builds the renderer body with the default background", () => {
    const payload = buildQuotePayload({
      source,
      format: "webp",
      color: undefined,
    });
    expect(payload.type).toBe("quote");
    expect(payload.format).toBe("webp");
    expect(payload.backgroundColor).toBe(DEFAULT_QUOTE_BACKGROUND);
    expect(payload.messages).toHaveLength(1);
    expect(payload.messages[0]?.from).toEqual({
      id: 42,
      name: "Ada",
      username: "ada",
    });
    expect(payload.messages[0]?.text).toBe("Hola");
    expect(payload.messages[0]?.avatar).toBe(true);
  });

  it("honours a custom colour and png format", () => {
    const payload = buildQuotePayload({
      source,
      format: "png",
      color: "#123456",
    });
    expect(payload.format).toBe("png");
    expect(payload.backgroundColor).toBe("#123456");
  });

  it("omits username when the author has none", () => {
    const payload = buildQuotePayload({
      source: { ...source, username: undefined },
      format: "webp",
      color: undefined,
    });
    expect(payload.messages[0]?.from).toEqual({ id: 42, name: "Ada" });
  });
});
