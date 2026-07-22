import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  buildDmSystemHint,
  shouldAutoChat,
  truncateDmInput,
} from "./dm-chat.js";

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

const privateText = (
  text: string,
  overrides: Partial<TelegramUpdateEnvelope> = {},
): TelegramUpdateEnvelope =>
  baseUpdate({
    chat: { chatId: 100n, chatType: "private", topicId: undefined },
    messageText: text,
    ...overrides,
  });

const cmd = (
  name: string,
  args: readonly string[] = [],
): TelegramUpdateEnvelope["command"] => ({
  name,
  raw: `/${name}${args.length > 0 ? ` ${args.join(" ")}` : ""}`,
  args,
});

describe("shouldAutoChat", () => {
  it("returns true for a plain private text message", () => {
    expect(shouldAutoChat(privateText("hola, que puedes hacer?"))).toBe(true);
  });

  it("returns false in a non-private chat", () => {
    expect(
      shouldAutoChat(baseUpdate({ messageText: "hola desde el grupo" })),
    ).toBe(false);
  });

  it("returns false for callback_query updates", () => {
    expect(
      shouldAutoChat(
        privateText("hola", { kind: "callback_query", callbackData: "x" }),
      ),
    ).toBe(false);
  });

  it("returns false for edited_message updates", () => {
    expect(
      shouldAutoChat(privateText("hola", { kind: "edited_message" })),
    ).toBe(false);
  });

  it("returns false when messageText is undefined", () => {
    expect(
      shouldAutoChat(
        baseUpdate({
          chat: { chatId: 100n, chatType: "private", topicId: undefined },
        }),
      ),
    ).toBe(false);
  });

  it("returns false when messageText is empty", () => {
    expect(shouldAutoChat(privateText(""))).toBe(false);
  });

  it("returns false when messageText is only whitespace", () => {
    expect(shouldAutoChat(privateText("   \n\t "))).toBe(false);
  });

  it("returns false when the update carries a command", () => {
    expect(
      shouldAutoChat(privateText("/ai hola", { command: cmd("ai", ["hola"]) })),
    ).toBe(false);
  });

  it("returns false when the text starts with # (note recall)", () => {
    expect(shouldAutoChat(privateText("#nota de la compra"))).toBe(false);
    expect(shouldAutoChat(privateText("  #nota"))).toBe(false);
  });

  it("returns false when the text starts with / (malformed command)", () => {
    expect(shouldAutoChat(privateText("/cmd inexistente"))).toBe(false);
    expect(shouldAutoChat(privateText("  /help"))).toBe(false);
  });

  it("returns false when isTextMessage is false", () => {
    expect(shouldAutoChat(privateText("hola", { isTextMessage: false }))).toBe(
      false,
    );
  });
});

describe("truncateDmInput", () => {
  it("returns the text unchanged when within the limit", () => {
    expect(truncateDmInput("hola", 10)).toBe("hola");
    expect(truncateDmInput("hola", 4)).toBe("hola");
    expect(truncateDmInput("", 5)).toBe("");
  });

  it("truncates and appends the ellipsis without exceeding the limit", () => {
    const result = truncateDmInput("abcdefghij", 5);
    expect(result).toBe("abcd…");
    expect(result.length).toBe(5);
  });

  it("returns only the ellipsis when maxChars <= 1", () => {
    expect(truncateDmInput("abcdef", 1)).toBe("…");
    expect(truncateDmInput("abcdef", 0)).toBe("…");
    expect(truncateDmInput("abcdef", -3)).toBe("…");
  });

  it("is deterministic for identical inputs", () => {
    expect(truncateDmInput("mensaje largo de prueba", 10)).toBe(
      truncateDmInput("mensaje largo de prueba", 10),
    );
  });
});

describe("buildDmSystemHint", () => {
  it("returns a non-empty spanish hint that mentions /help", () => {
    const hint = buildDmSystemHint();
    expect(hint.length).toBeGreaterThan(0);
    expect(hint).toContain("/help");
    expect(hint).toContain("Modryva");
    expect(hint).toContain("Me llamo Modryva");
  });

  it("is deterministic", () => {
    expect(buildDmSystemHint()).toBe(buildDmSystemHint());
  });
});
