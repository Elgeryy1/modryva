import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  buildReactionKeyboard,
  parseReactCommand,
  parseReactionCallback,
  REACTION_EMOJIS,
} from "./reactions.js";

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

describe("parseReactCommand", () => {
  it("parses /react and /reactpost with text", () => {
    expect(
      parseReactCommand(
        baseUpdate({ command: cmd("react", ["hola", "gente"]) }),
      ),
    ).toEqual({ ok: true, command: { text: "hola gente" } });
    expect(
      parseReactCommand(baseUpdate({ command: cmd("reactpost", ["hey"]) })),
    ).toEqual({ ok: true, command: { text: "hey" } });
  });

  it("errors without text and returns null for foreign commands", () => {
    expect(
      parseReactCommand(baseUpdate({ command: cmd("react", []) }))?.ok,
    ).toBe(false);
    expect(
      parseReactCommand(baseUpdate({ command: cmd("ban", []) })),
    ).toBeNull();
  });
});

describe("buildReactionKeyboard", () => {
  it("shows the count only when positive and every emoji", () => {
    const markup = buildReactionKeyboard({ "👍": 3 });
    const flat = JSON.stringify(markup);
    expect(flat).toContain("👍 3");
    for (const emoji of REACTION_EMOJIS) {
      expect(flat).toContain(`react:${emoji}`);
    }
    // ❤️ has no count -> bare emoji.
    expect(flat).toContain('"❤️"');
  });
});

describe("parseReactionCallback", () => {
  it("parses supported emojis and rejects others", () => {
    expect(parseReactionCallback("react:🔥")).toEqual({ emoji: "🔥" });
    expect(parseReactionCallback("react:🥔")).toBeNull();
    expect(parseReactionCallback("menu:home")).toBeNull();
    expect(parseReactionCallback(undefined)).toBeNull();
  });
});
