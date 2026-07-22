import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  type FedBanEntry,
  type FedInfoView,
  formatFedInfo,
  formatFedStat,
  parseFederationCommand,
  parseFedImport,
  serializeFedBans,
} from "./federations.js";

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

describe("parseFederationCommand", () => {
  it("returns null when the command is not in this module's set", () => {
    expect(parseFederationCommand(buildCommandUpdate("ban"))).toBeNull();
  });

  it("returns null when there is no command", () => {
    const update = buildCommandUpdate("newfed", ["Alianza"]);
    const withoutCommand: TelegramUpdateEnvelope = {
      ...update,
      command: undefined,
    };
    expect(parseFederationCommand(withoutCommand)).toBeNull();
  });

  describe("/newfed", () => {
    it("joins the remaining args into the name", () => {
      const result = parseFederationCommand(
        buildCommandUpdate("newfed", ["Gran", "Alianza"]),
      );
      expect(result).toEqual({
        ok: true,
        command: { kind: "new", name: "Gran Alianza" },
      });
    });

    it("rejects a missing name", () => {
      const result = parseFederationCommand(buildCommandUpdate("newfed", []));
      expect(result).toEqual({
        ok: false,
        error: { code: "name-required", usage: "Uso: /newfed <nombre>" },
      });
    });
  });

  describe("/joinfed", () => {
    it("parses the fedId", () => {
      const result = parseFederationCommand(
        buildCommandUpdate("joinfed", ["fed-abc"]),
      );
      expect(result).toEqual({
        ok: true,
        command: { kind: "join", fedId: "fed-abc" },
      });
    });

    it("rejects a missing fedId", () => {
      const result = parseFederationCommand(buildCommandUpdate("joinfed", []));
      expect(result).toEqual({
        ok: false,
        error: { code: "fedid-required", usage: "Uso: /joinfed <fedId>" },
      });
    });
  });

  describe("/subfed", () => {
    it("parses the fedId", () => {
      const result = parseFederationCommand(
        buildCommandUpdate("subfed", ["fed-xyz"]),
      );
      expect(result).toEqual({
        ok: true,
        command: { kind: "subfed", fedId: "fed-xyz" },
      });
    });

    it("rejects a missing fedId", () => {
      const result = parseFederationCommand(buildCommandUpdate("subfed", []));
      expect(result).toEqual({
        ok: false,
        error: { code: "fedid-required", usage: "Uso: /subfed <fedId>" },
      });
    });
  });

  describe("argument-less commands", () => {
    it("parses /leavefed", () => {
      expect(parseFederationCommand(buildCommandUpdate("leavefed"))).toEqual({
        ok: true,
        command: { kind: "leave" },
      });
    });

    it("parses /chatfed", () => {
      expect(parseFederationCommand(buildCommandUpdate("chatfed"))).toEqual({
        ok: true,
        command: { kind: "chatfed" },
      });
    });

    it("parses /fedadmins", () => {
      expect(parseFederationCommand(buildCommandUpdate("fedadmins"))).toEqual({
        ok: true,
        command: { kind: "fedadmins" },
      });
    });

    it("parses /setfedlog", () => {
      expect(parseFederationCommand(buildCommandUpdate("setfedlog"))).toEqual({
        ok: true,
        command: { kind: "setfedlog" },
      });
    });

    it("parses /fedexport", () => {
      expect(parseFederationCommand(buildCommandUpdate("fedexport"))).toEqual({
        ok: true,
        command: { kind: "export" },
      });
    });
  });

  describe("/fban", () => {
    it("parses a target id with a multi-word reason", () => {
      const result = parseFederationCommand(
        buildCommandUpdate("fban", ["55", "spam", "y", "flood"]),
      );
      expect(result).toEqual({
        ok: true,
        command: {
          kind: "fban",
          targetTelegramUserId: 55n,
          reason: "spam y flood",
        },
      });
    });

    it("parses a target id with no reason as undefined", () => {
      const result = parseFederationCommand(buildCommandUpdate("fban", ["55"]));
      expect(result).toEqual({
        ok: true,
        command: { kind: "fban", targetTelegramUserId: 55n, reason: undefined },
      });
    });

    it("parses a negative target id", () => {
      const result = parseFederationCommand(
        buildCommandUpdate("fban", ["-100500", "raid"]),
      );
      expect(result).toEqual({
        ok: true,
        command: {
          kind: "fban",
          targetTelegramUserId: -100500n,
          reason: "raid",
        },
      });
    });

    it("rejects a non-numeric target id", () => {
      const result = parseFederationCommand(
        buildCommandUpdate("fban", ["@someone", "rude"]),
      );
      expect(result).toEqual({
        ok: false,
        error: { code: "target-required", usage: "Uso: /fban <id_usuario>" },
      });
    });
  });

  describe("/unfban", () => {
    it("parses a target id", () => {
      const result = parseFederationCommand(
        buildCommandUpdate("unfban", ["42"]),
      );
      expect(result).toEqual({
        ok: true,
        command: { kind: "unfban", targetTelegramUserId: 42n },
      });
    });

    it("rejects a non-numeric target id", () => {
      const result = parseFederationCommand(
        buildCommandUpdate("unfban", ["nope"]),
      );
      expect(result).toEqual({
        ok: false,
        error: { code: "target-required", usage: "Uso: /unfban <id_usuario>" },
      });
    });
  });

  describe("/fedstat", () => {
    it("parses a target id", () => {
      const result = parseFederationCommand(
        buildCommandUpdate("fedstat", ["7"]),
      );
      expect(result).toEqual({
        ok: true,
        command: { kind: "stat", targetTelegramUserId: 7n },
      });
    });

    it("rejects a non-numeric target id", () => {
      const result = parseFederationCommand(
        buildCommandUpdate("fedstat", ["x"]),
      );
      expect(result).toEqual({
        ok: false,
        error: { code: "target-required", usage: "Uso: /fedstat <id_usuario>" },
      });
    });
  });

  describe("/fpromote", () => {
    it("parses a target id", () => {
      const result = parseFederationCommand(
        buildCommandUpdate("fpromote", ["99"]),
      );
      expect(result).toEqual({
        ok: true,
        command: { kind: "fpromote", targetTelegramUserId: 99n },
      });
    });

    it("rejects a non-numeric target id", () => {
      const result = parseFederationCommand(
        buildCommandUpdate("fpromote", ["abc"]),
      );
      expect(result).toEqual({
        ok: false,
        error: {
          code: "target-required",
          usage: "Uso: /fpromote <id_usuario>",
        },
      });
    });
  });

  describe("/fdemote", () => {
    it("parses a target id", () => {
      const result = parseFederationCommand(
        buildCommandUpdate("fdemote", ["99"]),
      );
      expect(result).toEqual({
        ok: true,
        command: { kind: "fdemote", targetTelegramUserId: 99n },
      });
    });

    it("rejects a non-numeric target id", () => {
      const result = parseFederationCommand(
        buildCommandUpdate("fdemote", ["12.5"]),
      );
      expect(result).toEqual({
        ok: false,
        error: { code: "target-required", usage: "Uso: /fdemote <id_usuario>" },
      });
    });
  });

  describe("/fedinfo", () => {
    it("parses without a fedId as undefined", () => {
      const result = parseFederationCommand(buildCommandUpdate("fedinfo", []));
      expect(result).toEqual({
        ok: true,
        command: { kind: "info", fedId: undefined },
      });
    });

    it("parses with a fedId", () => {
      const result = parseFederationCommand(
        buildCommandUpdate("fedinfo", ["fed-1"]),
      );
      expect(result).toEqual({
        ok: true,
        command: { kind: "info", fedId: "fed-1" },
      });
    });
  });

  describe("/fedimport", () => {
    it("joins the remaining args into the data", () => {
      const result = parseFederationCommand(
        buildCommandUpdate("fedimport", ['{"version":1,', '"bans":[]}']),
      );
      expect(result).toEqual({
        ok: true,
        command: { kind: "import", data: '{"version":1, "bans":[]}' },
      });
    });

    it("rejects missing data", () => {
      const result = parseFederationCommand(
        buildCommandUpdate("fedimport", []),
      );
      expect(result).toEqual({
        ok: false,
        error: { code: "data-required", usage: "Uso: /fedimport <json>" },
      });
    });
  });
});

describe("formatFedInfo", () => {
  const baseView: FedInfoView = {
    name: "Alianza",
    fedId: "fed-abc",
    ownerTelegramId: 12345n,
    chatCount: 3,
    banCount: 7,
    adminCount: 2,
    subscribedFedId: undefined,
  };

  it("formats a federation without a subscription", () => {
    const text = formatFedInfo(baseView);
    expect(text).toContain("Federacion: Alianza");
    expect(text).toContain("FedID: fed-abc");
    expect(text).toContain("Owner: 12345");
    expect(text).toContain("Chats: 3");
    expect(text).toContain("Bans: 7");
    expect(text).toContain("Admins: 2");
    expect(text).not.toContain("Suscrita a:");
  });

  it("formats a federation with a subscription", () => {
    const text = formatFedInfo({ ...baseView, subscribedFedId: "fed-parent" });
    expect(text).toContain("Suscrita a: fed-parent");
  });
});

describe("formatFedStat", () => {
  it("reports when the user is not banned anywhere", () => {
    expect(formatFedStat([])).toBe(
      "Este usuario no esta baneado en ninguna federacion.",
    );
  });

  it("lists each federation with its reason or 'sin motivo'", () => {
    const text = formatFedStat([
      { name: "Alianza", fedId: "fed-1", reason: "spam" },
      { name: "Guardia", fedId: "fed-2", reason: undefined },
    ]);
    expect(text).toBe(
      "En Alianza (fed-1): spam\nEn Guardia (fed-2): sin motivo",
    );
  });
});

describe("serializeFedBans / parseFedImport", () => {
  it("round-trips bans preserving bigint ids and reasons", () => {
    const bans: FedBanEntry[] = [
      { subjectTelegramId: 100n, reason: "spam" },
      { subjectTelegramId: -200n, reason: undefined },
    ];
    const json = serializeFedBans(bans);
    const parsed = parseFedImport(json);
    expect(parsed).toEqual(bans);
  });

  it("serializes deterministically with a stable shape", () => {
    const json = serializeFedBans([{ subjectTelegramId: 5n, reason: "abuso" }]);
    expect(json).toBe('{"version":1,"bans":[{"id":"5","reason":"abuso"}]}');
  });

  it("returns null for invalid JSON", () => {
    expect(parseFedImport("{ not json")).toBeNull();
  });

  it("returns null when the payload is not an object", () => {
    expect(parseFedImport("42")).toBeNull();
  });

  it("returns [] when there are no bans", () => {
    expect(parseFedImport('{"version":1}')).toEqual([]);
  });

  it("ignores malformed entries", () => {
    const json = JSON.stringify({
      version: 1,
      bans: [
        { id: "10", reason: "ok" },
        { id: "not-a-number", reason: "skip" },
        { reason: "no id" },
        { id: "20" },
      ],
    });
    expect(parseFedImport(json)).toEqual([
      { subjectTelegramId: 10n, reason: "ok" },
      { subjectTelegramId: 20n, reason: undefined },
    ]);
  });
});
