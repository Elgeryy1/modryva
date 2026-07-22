import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  isReservedCommand,
  normalizeCustomName,
  parseCustomCommandConfig,
} from "./custom-commands.js";

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

describe("parseCustomCommandConfig", () => {
  it("returns null for unrelated commands", () => {
    expect(
      parseCustomCommandConfig(buildCommandUpdate("ban", ["1"])),
    ).toBeNull();
  });

  it("returns null when there is no command", () => {
    const update = buildCommandUpdate("addcmd");
    const noCommand: TelegramUpdateEnvelope = { ...update, command: undefined };
    expect(parseCustomCommandConfig(noCommand)).toBeNull();
  });

  describe("addcmd", () => {
    it("parses an add with name and multi-word response", () => {
      expect(
        parseCustomCommandConfig(
          buildCommandUpdate("addcmd", ["Saludo", "hola", "a", "todos"]),
        ),
      ).toEqual({
        ok: true,
        command: { kind: "add", name: "saludo", response: "hola a todos" },
      });
    });

    it("normalizes a name with a leading slash", () => {
      expect(
        parseCustomCommandConfig(buildCommandUpdate("addcmd", ["/Hi", "yo"])),
      ).toEqual({
        ok: true,
        command: { kind: "add", name: "hi", response: "yo" },
      });
    });

    it("requires a name", () => {
      expect(
        parseCustomCommandConfig(buildCommandUpdate("addcmd", [])),
      ).toEqual({
        ok: false,
        error: {
          code: "name-required",
          usage: "Uso: /addcmd <nombre> <respuesta>",
        },
      });
    });

    it("treats a blank name argument as missing", () => {
      expect(
        parseCustomCommandConfig(buildCommandUpdate("addcmd", ["   ", "x"])),
      ).toMatchObject({ ok: false, error: { code: "name-required" } });
    });

    it("rejects an invalid name", () => {
      expect(
        parseCustomCommandConfig(
          buildCommandUpdate("addcmd", ["bad name", "x"]),
        ),
      ).toMatchObject({ ok: false, error: { code: "invalid-name" } });
    });

    it("rejects a name with uppercase-only invalid characters", () => {
      expect(
        parseCustomCommandConfig(buildCommandUpdate("addcmd", ["foo!", "x"])),
      ).toMatchObject({ ok: false, error: { code: "invalid-name" } });
    });

    it("rejects a name longer than 32 characters", () => {
      const longName = "a".repeat(33);
      expect(
        parseCustomCommandConfig(buildCommandUpdate("addcmd", [longName, "x"])),
      ).toMatchObject({ ok: false, error: { code: "invalid-name" } });
    });

    it("accepts a 32-character name", () => {
      const maxName = "a".repeat(32);
      expect(
        parseCustomCommandConfig(buildCommandUpdate("addcmd", [maxName, "x"])),
      ).toEqual({
        ok: true,
        command: { kind: "add", name: maxName, response: "x" },
      });
    });

    it("rejects adding a reserved command name", () => {
      expect(
        parseCustomCommandConfig(buildCommandUpdate("addcmd", ["start", "x"])),
      ).toMatchObject({ ok: false, error: { code: "invalid-name" } });
    });

    it("rejects adding a reserved name even with a leading slash", () => {
      expect(
        parseCustomCommandConfig(buildCommandUpdate("addcmd", ["/Help", "x"])),
      ).toMatchObject({ ok: false, error: { code: "invalid-name" } });
    });

    it("requires a response", () => {
      expect(
        parseCustomCommandConfig(buildCommandUpdate("addcmd", ["greet"])),
      ).toEqual({
        ok: false,
        error: {
          code: "response-required",
          usage: "Uso: /addcmd <nombre> <respuesta>",
        },
      });
    });

    it("treats a whitespace-only response as missing", () => {
      expect(
        parseCustomCommandConfig(buildCommandUpdate("addcmd", ["greet", "  "])),
      ).toMatchObject({ ok: false, error: { code: "response-required" } });
    });
  });

  describe("delcmd", () => {
    it("parses a remove and normalizes the name", () => {
      expect(
        parseCustomCommandConfig(buildCommandUpdate("delcmd", ["/Greet"])),
      ).toEqual({ ok: true, command: { kind: "remove", name: "greet" } });
    });

    it("requires a name", () => {
      expect(
        parseCustomCommandConfig(buildCommandUpdate("delcmd", [])),
      ).toEqual({
        ok: false,
        error: { code: "name-required", usage: "Uso: /delcmd <nombre>" },
      });
    });

    it("rejects an invalid name", () => {
      expect(
        parseCustomCommandConfig(buildCommandUpdate("delcmd", ["no-dashes"])),
      ).toMatchObject({ ok: false, error: { code: "invalid-name" } });
    });

    it("rejects removing a reserved name", () => {
      expect(
        parseCustomCommandConfig(buildCommandUpdate("delcmd", ["menu"])),
      ).toMatchObject({ ok: false, error: { code: "invalid-name" } });
    });
  });

  describe("cmds", () => {
    it("parses a list request", () => {
      expect(parseCustomCommandConfig(buildCommandUpdate("cmds"))).toEqual({
        ok: true,
        command: { kind: "list" },
      });
    });

    it("ignores extra arguments", () => {
      expect(
        parseCustomCommandConfig(buildCommandUpdate("cmds", ["extra"])),
      ).toEqual({ ok: true, command: { kind: "list" } });
    });
  });
});

describe("normalizeCustomName", () => {
  it("lowercases the value", () => {
    expect(normalizeCustomName("HELLO")).toBe("hello");
  });

  it("strips a single leading slash", () => {
    expect(normalizeCustomName("/cmd")).toBe("cmd");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeCustomName("  /Cmd  ")).toBe("cmd");
  });

  it("only strips one leading slash", () => {
    expect(normalizeCustomName("//cmd")).toBe("/cmd");
  });

  it("leaves an interior slash untouched", () => {
    expect(normalizeCustomName("a/b")).toBe("a/b");
  });
});

describe("isReservedCommand", () => {
  it("returns true for each reserved name", () => {
    for (const name of [
      "start",
      "help",
      "menu",
      "settings",
      "status",
      "cancel",
      "addcmd",
      "delcmd",
      "cmds",
    ]) {
      expect(isReservedCommand(name)).toBe(true);
    }
  });

  it("is case-insensitive", () => {
    expect(isReservedCommand("Start")).toBe(true);
    expect(isReservedCommand("MENU")).toBe(true);
  });

  it("returns false for a custom name", () => {
    expect(isReservedCommand("greet")).toBe(false);
  });
});
