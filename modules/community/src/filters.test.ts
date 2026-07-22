import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";
import { matchFilter, parseFilterCommand } from "./filters.js";

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

describe("parseFilterCommand", () => {
  it("parses /filter with trigger and response", () => {
    expect(
      parseFilterCommand(buildCommandUpdate("filter", ["Hola", "que", "tal"])),
    ).toEqual({
      ok: true,
      command: { kind: "add", trigger: "hola", response: "que tal" },
    });
  });

  it("requires a response for /filter", () => {
    expect(
      parseFilterCommand(buildCommandUpdate("filter", ["hola"])),
    ).toMatchObject({ ok: false, error: { code: "response-required" } });
  });

  it("parses /stop", () => {
    expect(parseFilterCommand(buildCommandUpdate("stop", ["hola"]))).toEqual({
      ok: true,
      command: { kind: "remove", trigger: "hola" },
    });
  });
});

describe("matchFilter", () => {
  it("matches a whole word case-insensitively", () => {
    expect(matchFilter("Hola a todos", ["hola"])).toBe("hola");
  });

  it("does not match inside a larger word", () => {
    expect(matchFilter("holanda es bonita", ["hola"])).toBeNull();
  });

  it("returns the first matching trigger in order", () => {
    expect(matchFilter("compra ahora gratis", ["gratis", "compra"])).toBe(
      "gratis",
    );
  });
});
