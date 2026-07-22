import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  buildWelcomeInlineKeyboard,
  parseWelcomeButtons,
  parseWelcomeCommand,
  renderTemplate,
  WELCOME_ADMINS_CALLBACK,
  WELCOME_RULES_CALLBACK,
} from "./welcome.js";

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

describe("parseWelcomeCommand", () => {
  it("parses /setwelcome with text", () => {
    expect(
      parseWelcomeCommand(
        buildCommandUpdate("setwelcome", ["Hola", "{first_name}"]),
      ),
    ).toEqual({
      ok: true,
      command: { kind: "set-welcome", text: "Hola {first_name}" },
    });
  });

  it("requires text for /setrules", () => {
    expect(parseWelcomeCommand(buildCommandUpdate("setrules"))).toMatchObject({
      ok: false,
      error: { code: "text-required" },
    });
  });

  it("parses /rules and /welcome shows", () => {
    expect(parseWelcomeCommand(buildCommandUpdate("rules"))).toEqual({
      ok: true,
      command: { kind: "show-rules" },
    });
    expect(parseWelcomeCommand(buildCommandUpdate("welcome"))).toEqual({
      ok: true,
      command: { kind: "show-welcome" },
    });
  });
});

describe("renderTemplate", () => {
  it("substitutes known placeholders", () => {
    expect(
      renderTemplate("Hola {first_name} en {chat_title}", {
        first_name: "Ana",
        chat_title: "Mi grupo",
      }),
    ).toBe("Hola Ana en Mi grupo");
  });

  it("replaces unknown placeholders with empty string", () => {
    expect(renderTemplate("Hola {missing}!", {})).toBe("Hola !");
  });
});

describe("parseWelcomeButtons", () => {
  it("keeps valid buttons and drops malformed ones", () => {
    const result = parseWelcomeButtons([
      { type: "rules", text: "Reglas" },
      { type: "url", text: "Canal", url: "https://t.me/x" },
      { type: "contact_admins", text: "Admins" },
      { type: "miniapp", text: "Menú" },
      { type: "url", text: "Sin url" }, // dropped: url required
      { type: "url", text: "Mala url", url: "javascript:alert(1)" }, // dropped: unsafe scheme
      { type: "bogus", text: "X" }, // dropped: unknown type
      { type: "rules", text: "   " }, // dropped: blank text
      "nope", // dropped: not an object
    ]);
    expect(result).toEqual([
      { type: "rules", text: "Reglas" },
      { type: "url", text: "Canal", url: "https://t.me/x" },
      { type: "contact_admins", text: "Admins" },
      { type: "miniapp", text: "Menú" },
    ]);
  });

  it("returns [] for non-array input", () => {
    expect(parseWelcomeButtons(null)).toEqual([]);
    expect(parseWelcomeButtons("x")).toEqual([]);
    expect(parseWelcomeButtons(undefined)).toEqual([]);
  });

  it("caps at 6 buttons", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      type: "rules" as const,
      text: `B${i}`,
    }));
    expect(parseWelcomeButtons(many)).toHaveLength(6);
  });

  it("trims and truncates button text to 64 chars", () => {
    const [button] = parseWelcomeButtons([
      { type: "rules", text: `  ${"x".repeat(100)}  ` },
    ]);
    expect(button?.text).toHaveLength(64);
  });
});

describe("buildWelcomeInlineKeyboard", () => {
  const ctx = { botUsername: "ModryvaBot", miniAppName: "config" };

  it("maps each button type to the right Telegram shape", () => {
    const kb = buildWelcomeInlineKeyboard(
      [
        { type: "rules", text: "Reglas" },
        { type: "contact_admins", text: "Admins" },
        { type: "url", text: "Canal", url: "https://t.me/x" },
        { type: "miniapp", text: "Menú" },
      ],
      ctx,
    );
    expect(kb).toEqual({
      inline_keyboard: [
        [{ text: "Reglas", callback_data: WELCOME_RULES_CALLBACK }],
        [{ text: "Admins", callback_data: WELCOME_ADMINS_CALLBACK }],
        [{ text: "Canal", url: "https://t.me/x" }],
        [{ text: "Menú", url: "https://t.me/ModryvaBot/config" }],
      ],
    });
  });

  it("returns undefined when nothing renders", () => {
    expect(buildWelcomeInlineKeyboard([], ctx)).toBeUndefined();
    expect(
      buildWelcomeInlineKeyboard([{ type: "url", text: "x" }], ctx),
    ).toBeUndefined();
  });

  it("omits the mini-app button when the bot username is missing", () => {
    expect(
      buildWelcomeInlineKeyboard([{ type: "miniapp", text: "Menú" }], {
        botUsername: "",
        miniAppName: "config",
      }),
    ).toBeUndefined();
  });
});
