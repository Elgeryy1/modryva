import type {
  MessageContentFlags,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  parseModerationExtraCommand,
  shouldEscalate,
} from "./moderation-extra.js";

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

describe("parseModerationExtraCommand", () => {
  it("returns null when the command is not in this module's set", () => {
    expect(parseModerationExtraCommand(buildCommandUpdate("ban"))).toBeNull();
  });

  it("returns null when there is no command", () => {
    const update = buildCommandUpdate("unwarn");
    const withoutCommand: TelegramUpdateEnvelope = {
      ...update,
      command: undefined,
    };
    expect(parseModerationExtraCommand(withoutCommand)).toBeNull();
  });

  describe("/unwarn", () => {
    it("parses a positive target id", () => {
      const result = parseModerationExtraCommand(
        buildCommandUpdate("unwarn", ["123"]),
      );
      expect(result).toEqual({
        ok: true,
        command: { kind: "unwarn", targetTelegramUserId: 123n },
      });
    });

    it("parses a negative target id", () => {
      const result = parseModerationExtraCommand(
        buildCommandUpdate("unwarn", ["-100500"]),
      );
      expect(result).toEqual({
        ok: true,
        command: { kind: "unwarn", targetTelegramUserId: -100500n },
      });
    });

    it("rejects a missing target id", () => {
      const result = parseModerationExtraCommand(
        buildCommandUpdate("unwarn", []),
      );
      expect(result).toEqual({
        ok: false,
        error: {
          code: "target-id-required",
          usage: "Uso: /unwarn <id_usuario>",
        },
      });
    });

    it("rejects a non-numeric target id", () => {
      const result = parseModerationExtraCommand(
        buildCommandUpdate("unwarn", ["abc"]),
      );
      expect(result?.ok).toBe(false);
      if (result && !result.ok) {
        expect(result.error.code).toBe("target-id-required");
      }
    });
  });

  describe("/resetwarn", () => {
    it("parses a target id into a reset command", () => {
      const result = parseModerationExtraCommand(
        buildCommandUpdate("resetwarn", ["42"]),
      );
      expect(result).toEqual({
        ok: true,
        command: { kind: "reset", targetTelegramUserId: 42n },
      });
    });

    it("rejects an invalid target id", () => {
      const result = parseModerationExtraCommand(
        buildCommandUpdate("resetwarn", ["12.5"]),
      );
      expect(result).toEqual({
        ok: false,
        error: {
          code: "target-id-required",
          usage: "Uso: /resetwarn <id_usuario>",
        },
      });
    });
  });

  describe("/warnings", () => {
    it("parses a target id into a list command", () => {
      const result = parseModerationExtraCommand(
        buildCommandUpdate("warnings", ["7"]),
      );
      expect(result).toEqual({
        ok: true,
        command: { kind: "list", targetTelegramUserId: 7n },
      });
    });

    it("rejects a missing target id", () => {
      const result = parseModerationExtraCommand(
        buildCommandUpdate("warnings", []),
      );
      expect(result).toEqual({
        ok: false,
        error: {
          code: "target-id-required",
          usage: "Uso: /warnings <id_usuario>",
        },
      });
    });
  });

  describe("/purge", () => {
    it("parses a count in range", () => {
      const result = parseModerationExtraCommand(
        buildCommandUpdate("purge", ["10"]),
      );
      expect(result).toEqual({
        ok: true,
        command: { kind: "purge", count: 10 },
      });
    });

    it("accepts the lower bound of 1", () => {
      const result = parseModerationExtraCommand(
        buildCommandUpdate("purge", ["1"]),
      );
      expect(result).toEqual({
        ok: true,
        command: { kind: "purge", count: 1 },
      });
    });

    it("accepts the upper bound of 100", () => {
      const result = parseModerationExtraCommand(
        buildCommandUpdate("purge", ["100"]),
      );
      expect(result).toEqual({
        ok: true,
        command: { kind: "purge", count: 100 },
      });
    });

    it("rejects 0 (below range)", () => {
      const result = parseModerationExtraCommand(
        buildCommandUpdate("purge", ["0"]),
      );
      expect(result).toEqual({
        ok: false,
        error: {
          code: "invalid-count",
          usage: "Uso: /purge <cantidad 1..100>",
        },
      });
    });

    it("rejects 101 (above range)", () => {
      const result = parseModerationExtraCommand(
        buildCommandUpdate("purge", ["101"]),
      );
      expect(result).toEqual({
        ok: false,
        error: {
          code: "invalid-count",
          usage: "Uso: /purge <cantidad 1..100>",
        },
      });
    });

    it("rejects a non-numeric count", () => {
      const result = parseModerationExtraCommand(
        buildCommandUpdate("purge", ["lots"]),
      );
      expect(result).toEqual({
        ok: false,
        error: {
          code: "invalid-count",
          usage: "Uso: /purge <cantidad 1..100>",
        },
      });
    });

    it("rejects a missing count", () => {
      const result = parseModerationExtraCommand(
        buildCommandUpdate("purge", []),
      );
      expect(result?.ok).toBe(false);
      if (result && !result.ok) {
        expect(result.error.code).toBe("invalid-count");
      }
    });
  });

  describe("/report", () => {
    it("parses a target id with a multi-word reason", () => {
      const result = parseModerationExtraCommand(
        buildCommandUpdate("report", ["55", "spam", "y", "flood"]),
      );
      expect(result).toEqual({
        ok: true,
        command: {
          kind: "report",
          targetTelegramUserId: 55n,
          reason: "spam y flood",
        },
      });
    });

    it("parses a target id with no reason as undefined", () => {
      const result = parseModerationExtraCommand(
        buildCommandUpdate("report", ["55"]),
      );
      expect(result).toEqual({
        ok: true,
        command: {
          kind: "report",
          targetTelegramUserId: 55n,
          reason: undefined,
        },
      });
    });

    it("treats a whitespace-only reason as undefined", () => {
      const result = parseModerationExtraCommand(
        buildCommandUpdate("report", ["55", "   "]),
      );
      expect(result).toEqual({
        ok: true,
        command: {
          kind: "report",
          targetTelegramUserId: 55n,
          reason: undefined,
        },
      });
    });

    it("rejects a missing target id", () => {
      const result = parseModerationExtraCommand(
        buildCommandUpdate("report", []),
      );
      expect(result).toEqual({
        ok: false,
        error: {
          code: "target-id-required",
          usage: "Uso: /report <id_usuario>",
        },
      });
    });

    it("rejects a non-numeric target id", () => {
      const result = parseModerationExtraCommand(
        buildCommandUpdate("report", ["@someone", "rude"]),
      );
      expect(result?.ok).toBe(false);
      if (result && !result.ok) {
        expect(result.error.code).toBe("target-id-required");
      }
    });
  });
});

describe("shouldEscalate", () => {
  it("returns false when below the limit", () => {
    expect(shouldEscalate(2, 3)).toBe(false);
  });

  it("returns true when exactly at the limit", () => {
    expect(shouldEscalate(3, 3)).toBe(true);
  });

  it("returns true when above the limit", () => {
    expect(shouldEscalate(5, 3)).toBe(true);
  });

  it("treats a limit of 0 as always escalating", () => {
    expect(shouldEscalate(0, 0)).toBe(true);
  });
});
