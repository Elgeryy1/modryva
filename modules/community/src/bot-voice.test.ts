import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  applyBotVoice,
  BOT_VOICES,
  isBotVoice,
  parseVoiceCommand,
} from "./bot-voice.js";

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
): TelegramUpdateEnvelope["command"] => ({
  name,
  raw: args.length > 0 ? `/${name} ${args.join(" ")}` : `/${name}`,
  args,
});

describe("BOT_VOICES", () => {
  it("exposes the five supported voices in order", () => {
    expect(BOT_VOICES).toEqual([
      "serio",
      "cercano",
      "gamer",
      "academico",
      "ironico",
    ]);
  });

  it("has no duplicate voices", () => {
    expect(new Set(BOT_VOICES).size).toBe(BOT_VOICES.length);
  });
});

describe("isBotVoice", () => {
  it("returns true for every supported voice", () => {
    for (const voice of BOT_VOICES) {
      expect(isBotVoice(voice)).toBe(true);
    }
  });

  it("returns false for unknown or empty strings", () => {
    expect(isBotVoice("payaso")).toBe(false);
    expect(isBotVoice("")).toBe(false);
    expect(isBotVoice("SERIO")).toBe(false);
  });
});

describe("applyBotVoice", () => {
  it("leaves the message untouched for the serio voice", () => {
    expect(applyBotVoice("Hola grupo", "serio")).toBe("Hola grupo");
  });

  it("decorates the cercano voice with a warm sign-off", () => {
    expect(applyBotVoice("Hola grupo", "cercano")).toBe(
      "😊 Hola grupo ¡Un abrazo!",
    );
  });

  it("decorates the gamer voice", () => {
    expect(applyBotVoice("Hola grupo", "gamer")).toBe(
      "🎮 Hola grupo ¡A darle, crack!",
    );
  });

  it("decorates the academico voice with an accented suffix", () => {
    expect(applyBotVoice("Hola grupo", "academico")).toBe(
      "📚 Hola grupo (referencia disponible bajo petición).",
    );
  });

  it("decorates the ironico voice", () => {
    expect(applyBotVoice("Hola grupo", "ironico")).toBe(
      "🙃 Hola grupo... o eso dicen.",
    );
  });

  it("returns the base message unchanged for an unknown voice", () => {
    expect(applyBotVoice("Hola grupo", "payaso")).toBe("Hola grupo");
  });

  it("handles an empty base message", () => {
    expect(applyBotVoice("", "cercano")).toBe("😊  ¡Un abrazo!");
  });

  it("is deterministic for identical inputs", () => {
    expect(applyBotVoice("ping", "gamer")).toBe(applyBotVoice("ping", "gamer"));
  });
});

describe("parseVoiceCommand", () => {
  it("parses /voz with a valid tone", () => {
    expect(
      parseVoiceCommand(baseUpdate({ command: cmd("voz", ["gamer"]) })),
    ).toEqual({ ok: true, command: { voice: "gamer" } });
  });

  it("lowercases the tone argument", () => {
    expect(
      parseVoiceCommand(baseUpdate({ command: cmd("voz", ["Serio"]) })),
    ).toEqual({ ok: true, command: { voice: "serio" } });
  });

  it("returns missing-voice error without argument", () => {
    const result = parseVoiceCommand(baseUpdate({ command: cmd("voz") }));
    expect(result).toEqual({
      ok: false,
      error: {
        code: "missing-voice",
        usage: "Uso: /voz serio|cercano|gamer|academico|ironico",
      },
    });
  });

  it("returns missing-voice error for an empty argument", () => {
    expect(
      parseVoiceCommand(baseUpdate({ command: cmd("voz", [""]) })),
    ).toEqual({
      ok: false,
      error: {
        code: "missing-voice",
        usage: "Uso: /voz serio|cercano|gamer|academico|ironico",
      },
    });
  });

  it("returns invalid-voice error for an unknown tone", () => {
    expect(
      parseVoiceCommand(baseUpdate({ command: cmd("voz", ["payaso"]) })),
    ).toEqual({
      ok: false,
      error: {
        code: "invalid-voice",
        usage: "Uso: /voz serio|cercano|gamer|academico|ironico",
      },
    });
  });

  it("returns null for other commands or no command", () => {
    expect(parseVoiceCommand(baseUpdate({ command: cmd("afk") }))).toBeNull();
    expect(parseVoiceCommand(baseUpdate())).toBeNull();
  });

  it("ignores extra arguments beyond the first", () => {
    expect(
      parseVoiceCommand(
        baseUpdate({ command: cmd("voz", ["ironico", "porfa"]) }),
      ),
    ).toEqual({ ok: true, command: { voice: "ironico" } });
  });
});
