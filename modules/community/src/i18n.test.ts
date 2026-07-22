import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import { langDisplayName, normalizeLang, parseLangCommand, t } from "./i18n.js";

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

describe("t / normalizeLang", () => {
  it("resolves translations with interpolation", () => {
    expect(
      t("welcome.default", "en", { first_name: "Ada", chat_title: "Dev" }),
    ).toBe("Welcome Ada to Dev.");
    expect(
      t("welcome.default", "es", { first_name: "Ada", chat_title: "Dev" }),
    ).toBe("Bienvenido Ada a Dev.");
  });

  it("falls back to Spanish then to the key", () => {
    expect(t("mod.no_permission", "fr")).toBe(t("mod.no_permission", "es"));
    expect(t("nonexistent.key", "en")).toBe("nonexistent.key");
  });

  it("normalizes unknown languages to es", () => {
    expect(normalizeLang("pt")).toBe("es");
    expect(normalizeLang("en")).toBe("en");
    expect(langDisplayName("en")).toBe("English");
  });
});

describe("parseLangCommand", () => {
  it("parses a supported language", () => {
    expect(
      parseLangCommand(baseUpdate({ command: cmd("lang", ["en"]) })),
    ).toEqual({ ok: true, command: { lang: "en" } });
  });

  it("errors on unsupported and returns null otherwise", () => {
    expect(
      parseLangCommand(baseUpdate({ command: cmd("lang", ["jp"]) }))?.ok,
    ).toBe(false);
    expect(
      parseLangCommand(baseUpdate({ command: cmd("stats", []) })),
    ).toBeNull();
  });
});
