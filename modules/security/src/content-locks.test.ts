import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";
import { evaluateLocks, parseLockCommand } from "./content-locks.js";

const baseContent: MessageContentFlags = {
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
  content: baseContent,
  attachment: undefined,
  preCheckout: undefined,
  successfulPayment: undefined,
  inlineQuery: undefined,
  messageId: 1,
  newChatMemberIds: [],
  isTextMessage: false,
  raw: {},
});

describe("evaluateLocks", () => {
  it("returns null when no locked type is present", () => {
    expect(
      evaluateLocks({ ...baseContent, hasText: true }, ["url", "photo"]),
    ).toBeNull();
  });

  it("detects a locked url", () => {
    expect(evaluateLocks({ ...baseContent, hasUrl: true }, ["url"])).toBe(
      "url",
    );
  });

  it("ignores a present type that is not locked", () => {
    expect(
      evaluateLocks({ ...baseContent, hasSticker: true }, ["url"]),
    ).toBeNull();
  });

  it("returns the first violated type in canonical order", () => {
    expect(
      evaluateLocks({ ...baseContent, hasUrl: true, hasPhoto: true }, [
        "photo",
        "url",
      ]),
    ).toBe("url");
  });
});

describe("parseLockCommand", () => {
  it("lists locks with /locks", () => {
    expect(parseLockCommand(buildCommandUpdate("locks"))).toEqual({
      ok: true,
      command: { kind: "list" },
    });
  });

  it("parses /lock with multiple valid types", () => {
    expect(
      parseLockCommand(buildCommandUpdate("lock", ["url", "Sticker"])),
    ).toEqual({
      ok: true,
      command: { kind: "lock", types: ["url", "sticker"] },
    });
  });

  it("rejects an unknown type", () => {
    expect(
      parseLockCommand(buildCommandUpdate("lock", ["banana"])),
    ).toMatchObject({ ok: false, error: { code: "invalid-type" } });
  });

  it("requires at least one type", () => {
    expect(parseLockCommand(buildCommandUpdate("lock", []))).toMatchObject({
      ok: false,
      error: { code: "type-required" },
    });
  });
});
