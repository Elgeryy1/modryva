import type {
  MessageAttachment,
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";
import { parseFilesCommand, validateAttachment } from "./files.js";

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

const buildCommandUpdate = (name: string): TelegramUpdateEnvelope => ({
  updateId: 1,
  kind: "message",
  receivedAt: new Date(0),
  chat: { chatId: -100n, chatType: "supergroup", topicId: undefined },
  user: { userId: 1n, username: "tester", languageCode: "es" },
  command: { name, raw: `/${name}`, args: [] },
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

const attachment = (over: Partial<MessageAttachment>): MessageAttachment => ({
  kind: "document",
  fileId: "f",
  fileUniqueId: "u",
  mimeType: "application/pdf",
  fileSize: 100,
  fileName: "doc.pdf",
  ...over,
});

describe("validateAttachment", () => {
  it("accepts a normal document", () => {
    expect(validateAttachment(attachment({}))).toEqual({ ok: true });
  });

  it("rejects oversize files", () => {
    expect(
      validateAttachment(attachment({ fileSize: 999 }), {
        maxBytes: 100,
        allowedMimePrefixes: [],
      }),
    ).toMatchObject({ ok: false, reason: "too-large" });
  });

  it("rejects dangerous extensions", () => {
    expect(validateAttachment(attachment({ fileName: "x.exe" }))).toMatchObject(
      { ok: false, reason: "blocked-extension" },
    );
  });

  it("enforces an allowlist of MIME prefixes", () => {
    expect(
      validateAttachment(attachment({ mimeType: "application/pdf" }), {
        maxBytes: 1000,
        allowedMimePrefixes: ["image/"],
      }),
    ).toMatchObject({ ok: false, reason: "mime-not-allowed" });
    expect(
      validateAttachment(
        attachment({ mimeType: "image/png", fileName: "a.png" }),
        {
          maxBytes: 1000,
          allowedMimePrefixes: ["image/"],
        },
      ),
    ).toEqual({ ok: true });
  });
});

describe("parseFilesCommand", () => {
  it("parses /files and /filequota", () => {
    expect(parseFilesCommand(buildCommandUpdate("files"))).toEqual({
      ok: true,
      command: { kind: "list" },
    });
    expect(parseFilesCommand(buildCommandUpdate("filequota"))).toEqual({
      ok: true,
      command: { kind: "quota" },
    });
  });

  it("returns null for other commands", () => {
    expect(parseFilesCommand(buildCommandUpdate("ban"))).toBeNull();
  });
});
