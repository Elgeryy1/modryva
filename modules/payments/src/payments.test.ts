import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  buildInvoicePayload,
  parseInvoicePayload,
  parsePaymentCommand,
} from "./payments.js";

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

describe("parsePaymentCommand", () => {
  it("parses /products, /buy and /addproduct", () => {
    expect(parsePaymentCommand(buildCommandUpdate("products"))).toEqual({
      ok: true,
      command: { kind: "list" },
    });
    expect(parsePaymentCommand(buildCommandUpdate("buy", ["pro"]))).toEqual({
      ok: true,
      command: { kind: "buy", productId: "pro" },
    });
    expect(
      parsePaymentCommand(
        buildCommandUpdate("addproduct", ["pro", "50", "Plan", "Pro"]),
      ),
    ).toEqual({
      ok: true,
      command: { kind: "add", productId: "pro", amount: 50, title: "Plan Pro" },
    });
  });

  it("rejects invalid add input", () => {
    expect(
      parsePaymentCommand(buildCommandUpdate("addproduct", ["pro", "0", "x"])),
    ).toMatchObject({ ok: false, error: { code: "format" } });
    expect(
      parsePaymentCommand(buildCommandUpdate("buy", ["!!"])),
    ).toMatchObject({ ok: false, error: { code: "product-required" } });
  });
});

describe("invoice payload", () => {
  it("round-trips product id and user id", () => {
    const payload = buildInvoicePayload("pro", 42n);
    expect(parseInvoicePayload(payload)).toEqual({
      productId: "pro",
      telegramUserId: 42n,
    });
  });

  it("rejects malformed payloads", () => {
    expect(parseInvoicePayload("nope")).toBeNull();
    expect(parseInvoicePayload("product:pro:abc")).toBeNull();
  });
});
