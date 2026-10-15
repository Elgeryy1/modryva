import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  cjkRatio,
  parseCharFilterCommand,
  rtlRatio,
  shouldFilterByChars,
} from "./char-filters.js";

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

describe("script ratios", () => {
  it("measures RTL and CJK letter fractions", () => {
    expect(rtlRatio("مرحبا")).toBeGreaterThan(0.9);
    expect(rtlRatio("hola")).toBe(0);
    expect(cjkRatio("你好世界")).toBeGreaterThan(0.9);
    expect(cjkRatio("hello")).toBe(0);
  });

  it("ignores non-letters in the ratio", () => {
    // Mixed: 4 latin + 4 arabic letters -> 0.5, not > 0.5.
    expect(rtlRatio("test مرحب")).toBeCloseTo(0.5, 1);
  });
});

describe("shouldFilterByChars", () => {
  const cfg = { rtlFilter: true, cjkFilter: true };

  it("filters mostly-RTL and mostly-CJK messages", () => {
    expect(shouldFilterByChars("مرحبا بك في", cfg)).toBe(true);
    expect(shouldFilterByChars("你好世界大家", cfg)).toBe(true);
  });

  it("does not filter latin text or when disabled", () => {
    expect(shouldFilterByChars("hola que tal amigos", cfg)).toBe(false);
    expect(
      shouldFilterByChars("مرحبا بك في", {
        rtlFilter: false,
        cjkFilter: false,
      }),
    ).toBe(false);
  });

  it("ignores very short messages", () => {
    expect(shouldFilterByChars("hi", cfg)).toBe(false);
  });
});

describe("parseCharFilterCommand", () => {
  it("parses rtl/cjk toggles and errors", () => {
    expect(
      parseCharFilterCommand(baseUpdate({ command: cmd("rtlfilter", ["on"]) })),
    ).toEqual({ ok: true, command: { kind: "rtl", enabled: true } });
    expect(
      parseCharFilterCommand(
        baseUpdate({ command: cmd("cjkfilter", ["off"]) }),
      ),
    ).toEqual({ ok: true, command: { kind: "cjk", enabled: false } });
    expect(
      parseCharFilterCommand(baseUpdate({ command: cmd("rtlfilter", ["x"]) }))
        ?.ok,
    ).toBe(false);
    expect(
      parseCharFilterCommand(baseUpdate({ command: cmd("ban", []) })),
    ).toBeNull();
  });
});
