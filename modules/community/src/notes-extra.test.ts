import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  filterCooldownOk,
  type PortableNote,
  parseNotesImport,
  parseNotesPortCommand,
  serializeNotes,
} from "./notes-extra.js";

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

describe("parseNotesPortCommand", () => {
  it("parses /export", () => {
    expect(parseNotesPortCommand(buildCommandUpdate("export"))).toEqual({
      ok: true,
      command: { kind: "export" },
    });
  });

  it("ignores extra args for /export", () => {
    expect(
      parseNotesPortCommand(buildCommandUpdate("export", ["ignored"])),
    ).toEqual({
      ok: true,
      command: { kind: "export" },
    });
  });

  it("parses /import with a single json arg", () => {
    expect(
      parseNotesPortCommand(buildCommandUpdate("import", ['{"notes":[]}'])),
    ).toEqual({
      ok: true,
      command: { kind: "import", raw: '{"notes":[]}' },
    });
  });

  it("joins multiple /import args with spaces", () => {
    expect(
      parseNotesPortCommand(
        buildCommandUpdate("import", ['{"notes":', "[]", "}"]),
      ),
    ).toEqual({
      ok: true,
      command: { kind: "import", raw: '{"notes": [] }' },
    });
  });

  it("requires data for /import", () => {
    expect(parseNotesPortCommand(buildCommandUpdate("import"))).toMatchObject({
      ok: false,
      error: { code: "data-required" },
    });
  });

  it("treats whitespace-only /import args as missing data", () => {
    expect(
      parseNotesPortCommand(buildCommandUpdate("import", ["  ", " "])),
    ).toMatchObject({
      ok: false,
      error: { code: "data-required" },
    });
  });

  it("uses a Spanish usage string with no accents", () => {
    const result = parseNotesPortCommand(buildCommandUpdate("import"));
    expect(result).not.toBeNull();
    if (result && !result.ok) {
      expect(result.error.usage).toBe("Uso: /import <json>");
    }
  });

  it("returns null for unrelated commands", () => {
    expect(parseNotesPortCommand(buildCommandUpdate("save", ["x"]))).toBeNull();
    expect(parseNotesPortCommand(buildCommandUpdate("notes"))).toBeNull();
  });
});

describe("serializeNotes", () => {
  it("wraps notes with a version field", () => {
    const notes: readonly PortableNote[] = [
      { name: "rules", content: "no spam" },
    ];
    expect(serializeNotes(notes)).toBe(
      '{"version":1,"notes":[{"name":"rules","content":"no spam"}]}',
    );
  });

  it("serializes an empty list", () => {
    expect(serializeNotes([])).toBe('{"version":1,"notes":[]}');
  });
});

describe("serialize/parse round-trip", () => {
  it("round-trips through the object form", () => {
    const notes: readonly PortableNote[] = [
      { name: "rules", content: "no spam" },
      { name: "welcome", content: "hola" },
    ];
    const parsed = parseNotesImport(serializeNotes(notes));
    expect(parsed).toEqual(notes);
  });

  it("round-trips an empty list", () => {
    expect(parseNotesImport(serializeNotes([]))).toEqual([]);
  });
});

describe("parseNotesImport", () => {
  it("accepts a bare array of notes", () => {
    expect(
      parseNotesImport(
        '[{"name":"a","content":"x"},{"name":"b","content":""}]',
      ),
    ).toEqual([
      { name: "a", content: "x" },
      { name: "b", content: "" },
    ]);
  });

  it("accepts an object with a notes array", () => {
    expect(parseNotesImport('{"notes":[{"name":"a","content":"x"}]}')).toEqual([
      { name: "a", content: "x" },
    ]);
  });

  it("allows empty string content", () => {
    expect(parseNotesImport('[{"name":"a","content":""}]')).toEqual([
      { name: "a", content: "" },
    ]);
  });

  it("ignores extra fields on each entry", () => {
    expect(parseNotesImport('[{"name":"a","content":"x","extra":42}]')).toEqual(
      [{ name: "a", content: "x" }],
    );
  });

  it("returns null on invalid json", () => {
    expect(parseNotesImport("not json")).toBeNull();
    expect(parseNotesImport("")).toBeNull();
    expect(parseNotesImport("{")).toBeNull();
  });

  it("returns null when top-level is a primitive", () => {
    expect(parseNotesImport("42")).toBeNull();
    expect(parseNotesImport('"hello"')).toBeNull();
    expect(parseNotesImport("true")).toBeNull();
    expect(parseNotesImport("null")).toBeNull();
  });

  it("returns null when notes is not an array", () => {
    expect(parseNotesImport('{"notes":"nope"}')).toBeNull();
    expect(parseNotesImport('{"notes":{}}')).toBeNull();
    expect(parseNotesImport("{}")).toBeNull();
  });

  it("returns null when an entry is missing a name", () => {
    expect(parseNotesImport('[{"content":"x"}]')).toBeNull();
  });

  it("returns null when name is empty or whitespace", () => {
    expect(parseNotesImport('[{"name":"","content":"x"}]')).toBeNull();
    expect(parseNotesImport('[{"name":"   ","content":"x"}]')).toBeNull();
  });

  it("returns null when name is not a string", () => {
    expect(parseNotesImport('[{"name":5,"content":"x"}]')).toBeNull();
  });

  it("returns null when content is missing or not a string", () => {
    expect(parseNotesImport('[{"name":"a"}]')).toBeNull();
    expect(parseNotesImport('[{"name":"a","content":5}]')).toBeNull();
    expect(parseNotesImport('[{"name":"a","content":null}]')).toBeNull();
  });

  it("returns null when an entry is not an object", () => {
    expect(parseNotesImport('["a","b"]')).toBeNull();
    expect(parseNotesImport("[null]")).toBeNull();
  });

  it("accepts exactly 200 notes", () => {
    const entries = Array.from({ length: 200 }, (_, i) => ({
      name: `n${i}`,
      content: "c",
    }));
    const parsed = parseNotesImport(JSON.stringify(entries));
    expect(parsed).not.toBeNull();
    expect(parsed).toHaveLength(200);
  });

  it("returns null when over the 200 note cap", () => {
    const entries = Array.from({ length: 201 }, (_, i) => ({
      name: `n${i}`,
      content: "c",
    }));
    expect(parseNotesImport(JSON.stringify(entries))).toBeNull();
  });
});

describe("filterCooldownOk", () => {
  it("is true when never triggered", () => {
    expect(filterCooldownOk(undefined, 0, 60)).toBe(true);
    expect(filterCooldownOk(undefined, 1000, 60)).toBe(true);
  });

  it("is false within the cooldown window", () => {
    expect(filterCooldownOk(1000, 1000 + 59_999, 60)).toBe(false);
  });

  it("is true exactly at the cooldown boundary", () => {
    expect(filterCooldownOk(1000, 1000 + 60_000, 60)).toBe(true);
  });

  it("is true after the cooldown window", () => {
    expect(filterCooldownOk(1000, 1000 + 60_001, 60)).toBe(true);
  });

  it("is always true for a zero cooldown", () => {
    expect(filterCooldownOk(1000, 1000, 0)).toBe(true);
  });
});
