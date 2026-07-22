import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  buildWebhookBody,
  parseWebhookCommand,
  signWebhook,
  verifyWebhookSignature,
} from "./webhooks.js";

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

describe("parseWebhookCommand", () => {
  it("returns null when the command is not webhook", () => {
    expect(parseWebhookCommand(buildCommandUpdate("rss", ["list"]))).toBeNull();
    expect(parseWebhookCommand(buildCommandUpdate("other"))).toBeNull();
  });

  it("parses add with a valid https url", () => {
    expect(
      parseWebhookCommand(
        buildCommandUpdate("webhook", ["add", "https://hooks.e.com/in"]),
      ),
    ).toEqual({
      ok: true,
      command: { kind: "add", url: "https://hooks.e.com/in" },
    });
  });

  it("parses add with a valid http url", () => {
    expect(
      parseWebhookCommand(
        buildCommandUpdate("webhook", ["add", "http://hooks.e.com/in"]),
      ),
    ).toEqual({
      ok: true,
      command: { kind: "add", url: "http://hooks.e.com/in" },
    });
  });

  it("rejects add with a missing url", () => {
    expect(
      parseWebhookCommand(buildCommandUpdate("webhook", ["add"])),
    ).toMatchObject({ ok: false, error: { code: "url-required" } });
  });

  it("rejects add with an invalid (non-http) url", () => {
    expect(
      parseWebhookCommand(buildCommandUpdate("webhook", ["add", "ftp://x"])),
    ).toMatchObject({ ok: false, error: { code: "url-invalid" } });
    expect(
      parseWebhookCommand(buildCommandUpdate("webhook", ["add", "not a url"])),
    ).toMatchObject({ ok: false, error: { code: "url-invalid" } });
  });

  it("parses list", () => {
    expect(
      parseWebhookCommand(buildCommandUpdate("webhook", ["list"])),
    ).toEqual({ ok: true, command: { kind: "list" } });
  });

  it("parses remove with an id", () => {
    expect(
      parseWebhookCommand(buildCommandUpdate("webhook", ["remove", "wh_1"])),
    ).toEqual({ ok: true, command: { kind: "remove", webhookId: "wh_1" } });
  });

  it("rejects remove with a missing id", () => {
    expect(
      parseWebhookCommand(buildCommandUpdate("webhook", ["remove"])),
    ).toMatchObject({ ok: false, error: { code: "id-required" } });
  });

  it("returns a usage error for unknown subcommands or no args", () => {
    expect(
      parseWebhookCommand(buildCommandUpdate("webhook", ["frobnicate"])),
    ).toMatchObject({ ok: false, error: { code: "usage" } });
    expect(parseWebhookCommand(buildCommandUpdate("webhook"))).toMatchObject({
      ok: false,
      error: { code: "usage" },
    });
  });

  it("treats subcommands case-insensitively", () => {
    expect(
      parseWebhookCommand(buildCommandUpdate("webhook", ["LIST"])),
    ).toEqual({ ok: true, command: { kind: "list" } });
  });
});

describe("buildWebhookBody", () => {
  it("produces a deterministic JSON body for the same inputs", () => {
    const a = buildWebhookBody("user.joined", { id: 7, name: "x" }, 0);
    const b = buildWebhookBody("user.joined", { id: 7, name: "x" }, 0);
    expect(a).toBe(b);
  });

  it("serializes event, sentAt (from atMs) and payload", () => {
    const body = buildWebhookBody("ping", { ok: true }, 1_700_000_000_000);
    expect(JSON.parse(body)).toEqual({
      event: "ping",
      sentAt: "2023-11-14T22:13:20.000Z",
      payload: { ok: true },
    });
  });

  it("changes when atMs changes", () => {
    const a = buildWebhookBody("ping", {}, 0);
    const b = buildWebhookBody("ping", {}, 1000);
    expect(a).not.toBe(b);
  });
});

describe("signWebhook / verifyWebhookSignature", () => {
  it("produces a stable hex HMAC-SHA256 signature", () => {
    const body = buildWebhookBody("ping", { n: 1 }, 0);
    const sig = signWebhook(body, "s3cr3t");
    expect(sig).toMatch(/^[0-9a-f]{64}$/u);
    expect(signWebhook(body, "s3cr3t")).toBe(sig);
  });

  it("round-trips: a fresh signature verifies", () => {
    const body = buildWebhookBody("order.created", { id: 42 }, 123456);
    const sig = signWebhook(body, "shared-secret");
    expect(verifyWebhookSignature(body, "shared-secret", sig)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = buildWebhookBody("order.created", { id: 42 }, 123456);
    const sig = signWebhook(body, "shared-secret");
    const tampered = buildWebhookBody("order.created", { id: 43 }, 123456);
    expect(verifyWebhookSignature(tampered, "shared-secret", sig)).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const body = buildWebhookBody("ping", {}, 0);
    const sig = signWebhook(body, "right");
    expect(verifyWebhookSignature(body, "wrong", sig)).toBe(false);
  });

  it("rejects a malformed or length-mismatched signature", () => {
    const body = buildWebhookBody("ping", {}, 0);
    expect(verifyWebhookSignature(body, "s", "deadbeef")).toBe(false);
    expect(verifyWebhookSignature(body, "s", "zz")).toBe(false);
    expect(verifyWebhookSignature(body, "s", "")).toBe(false);
  });
});
