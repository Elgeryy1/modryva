import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";
import { detectNoteRecall, parseNotesCommand } from "./notes.js";

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

describe("parseNotesCommand", () => {
  it("parses /save with name and content", () => {
    expect(
      parseNotesCommand(buildCommandUpdate("save", ["Rules", "no", "spam"])),
    ).toEqual({
      ok: true,
      command: { kind: "save", name: "rules", content: "no spam" },
    });
  });

  it("requires content for /save", () => {
    expect(
      parseNotesCommand(buildCommandUpdate("save", ["rules"])),
    ).toMatchObject({ ok: false, error: { code: "content-required" } });
  });

  it("parses /get and strips a leading hash", () => {
    expect(parseNotesCommand(buildCommandUpdate("get", ["#rules"]))).toEqual({
      ok: true,
      command: { kind: "get", name: "rules" },
    });
  });

  it("lists notes with /notes", () => {
    expect(parseNotesCommand(buildCommandUpdate("notes"))).toEqual({
      ok: true,
      command: { kind: "list" },
    });
  });

  it("returns null for unrelated commands", () => {
    expect(parseNotesCommand(buildCommandUpdate("ban", ["1"]))).toBeNull();
  });
});

describe("detectNoteRecall", () => {
  it("detects a single hashtag recall", () => {
    expect(detectNoteRecall("#rules")).toBe("rules");
  });

  it("ignores multi-word messages", () => {
    expect(detectNoteRecall("#rules please")).toBeNull();
  });

  it("ignores plain text", () => {
    expect(detectNoteRecall("hello")).toBeNull();
  });
});
