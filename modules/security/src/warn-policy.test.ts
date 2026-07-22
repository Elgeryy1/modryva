import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  buildRemoveWarnButton,
  decideWarnEscalation,
  defaultWarnPolicy,
  formatWarnPolicy,
  parseCompactDuration,
  parseRemoveWarnCallback,
  parseWarnConfigCommand,
  type WarnPolicy,
} from "./warn-policy.js";

const baseUpdate = (
  o: Partial<TelegramUpdateEnvelope> = {},
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
  ...o,
});

const cmd = (
  name: string,
  args: readonly string[],
): { name: string; raw: string; args: readonly string[] } => ({
  name,
  raw: `/${name} ${args.join(" ")}`,
  args,
});

describe("parseWarnConfigCommand", () => {
  it("returns null when the command is not part of this module", () => {
    expect(
      parseWarnConfigCommand(baseUpdate({ command: cmd("ban", ["7"]) })),
    ).toBeNull();
  });

  it("returns null when there is no command", () => {
    expect(parseWarnConfigCommand(baseUpdate())).toBeNull();
  });

  describe("/warnpolicy", () => {
    it("parses into a show command", () => {
      const result = parseWarnConfigCommand(
        baseUpdate({ command: cmd("warnpolicy", []) }),
      );
      expect(result).toEqual({ ok: true, command: { kind: "show" } });
    });
  });

  describe("/setwarnlimit", () => {
    it("parses a limit inside 1..20", () => {
      const result = parseWarnConfigCommand(
        baseUpdate({ command: cmd("setwarnlimit", ["5"]) }),
      );
      expect(result).toEqual({
        ok: true,
        command: { kind: "setLimit", limit: 5 },
      });
    });

    it("accepts the lower bound 1", () => {
      const result = parseWarnConfigCommand(
        baseUpdate({ command: cmd("setwarnlimit", ["1"]) }),
      );
      expect(result).toEqual({
        ok: true,
        command: { kind: "setLimit", limit: 1 },
      });
    });

    it("accepts the upper bound 20", () => {
      const result = parseWarnConfigCommand(
        baseUpdate({ command: cmd("setwarnlimit", ["20"]) }),
      );
      expect(result).toEqual({
        ok: true,
        command: { kind: "setLimit", limit: 20 },
      });
    });

    it("rejects 0 (below range)", () => {
      const result = parseWarnConfigCommand(
        baseUpdate({ command: cmd("setwarnlimit", ["0"]) }),
      );
      expect(result).toEqual({
        ok: false,
        error: {
          code: "limit-out-of-range",
          usage: "Uso: /setwarnlimit <1..20>",
        },
      });
    });

    it("rejects 21 (above range)", () => {
      const result = parseWarnConfigCommand(
        baseUpdate({ command: cmd("setwarnlimit", ["21"]) }),
      );
      expect(result?.ok).toBe(false);
      if (result && !result.ok) {
        expect(result.error.code).toBe("limit-out-of-range");
      }
    });

    it("rejects a non-numeric limit", () => {
      const result = parseWarnConfigCommand(
        baseUpdate({ command: cmd("setwarnlimit", ["muchos"]) }),
      );
      expect(result?.ok).toBe(false);
      if (result && !result.ok) {
        expect(result.error.code).toBe("limit-out-of-range");
      }
    });
  });

  describe("/setwarnmode", () => {
    it("parses a non-timed mode with no duration", () => {
      const result = parseWarnConfigCommand(
        baseUpdate({ command: cmd("setwarnmode", ["ban"]) }),
      );
      expect(result).toEqual({
        ok: true,
        command: { kind: "setMode", mode: "ban", durationMs: undefined },
      });
    });

    it("parses mute (non-timed) ignoring any extra arg", () => {
      const result = parseWarnConfigCommand(
        baseUpdate({ command: cmd("setwarnmode", ["mute", "2h"]) }),
      );
      expect(result).toEqual({
        ok: true,
        command: { kind: "setMode", mode: "mute", durationMs: undefined },
      });
    });

    it("parses tban with a required duration", () => {
      const result = parseWarnConfigCommand(
        baseUpdate({ command: cmd("setwarnmode", ["tban", "2h"]) }),
      );
      expect(result).toEqual({
        ok: true,
        command: { kind: "setMode", mode: "tban", durationMs: 7_200_000 },
      });
    });

    it("parses tmute with a required duration", () => {
      const result = parseWarnConfigCommand(
        baseUpdate({ command: cmd("setwarnmode", ["tmute", "30m"]) }),
      );
      expect(result).toEqual({
        ok: true,
        command: { kind: "setMode", mode: "tmute", durationMs: 1_800_000 },
      });
    });

    it("rejects tban without a duration", () => {
      const result = parseWarnConfigCommand(
        baseUpdate({ command: cmd("setwarnmode", ["tban"]) }),
      );
      expect(result?.ok).toBe(false);
      if (result && !result.ok) {
        expect(result.error.code).toBe("duration-required");
      }
    });

    it("rejects tmute with an invalid duration", () => {
      const result = parseWarnConfigCommand(
        baseUpdate({ command: cmd("setwarnmode", ["tmute", "zzz"]) }),
      );
      expect(result?.ok).toBe(false);
      if (result && !result.ok) {
        expect(result.error.code).toBe("duration-required");
      }
    });

    it("rejects an invalid mode", () => {
      const result = parseWarnConfigCommand(
        baseUpdate({ command: cmd("setwarnmode", ["explode"]) }),
      );
      expect(result).toEqual({
        ok: false,
        error: {
          code: "invalid-mode",
          usage:
            "Uso: /setwarnmode ban|kick|mute|tban <duracion>|tmute <duracion>",
        },
      });
    });
  });

  describe("/setwarntime", () => {
    it("parses off into a null expireMs", () => {
      const result = parseWarnConfigCommand(
        baseUpdate({ command: cmd("setwarntime", ["off"]) }),
      );
      expect(result).toEqual({
        ok: true,
        command: { kind: "setTime", expireMs: null },
      });
    });

    it("parses a compact duration into expireMs", () => {
      const result = parseWarnConfigCommand(
        baseUpdate({ command: cmd("setwarntime", ["7d"]) }),
      );
      expect(result).toEqual({
        ok: true,
        command: { kind: "setTime", expireMs: 604_800_000 },
      });
    });

    it("rejects an invalid duration", () => {
      const result = parseWarnConfigCommand(
        baseUpdate({ command: cmd("setwarntime", ["nunca"]) }),
      );
      expect(result).toEqual({
        ok: false,
        error: {
          code: "invalid-duration",
          usage: "Uso: /setwarntime <duracion: 30m|2h|7d|4w|off>",
        },
      });
    });
  });
});

describe("parseCompactDuration", () => {
  it("parses minutes", () => {
    expect(parseCompactDuration("30m")).toBe(1_800_000);
  });

  it("parses hours", () => {
    expect(parseCompactDuration("2h")).toBe(7_200_000);
  });

  it("parses days", () => {
    expect(parseCompactDuration("7d")).toBe(604_800_000);
  });

  it("parses weeks", () => {
    expect(parseCompactDuration("4w")).toBe(2_419_200_000);
  });

  it("returns null for an invalid format", () => {
    expect(parseCompactDuration("10x")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseCompactDuration(undefined)).toBeNull();
  });
});

describe("decideWarnEscalation", () => {
  const policy: WarnPolicy = {
    limit: 3,
    mode: "tmute",
    durationMs: 3_600_000,
    expireMs: undefined,
  };

  it("does not escalate below the limit", () => {
    expect(decideWarnEscalation(2, policy)).toEqual({
      escalate: false,
      mode: "tmute",
      durationMs: 3_600_000,
    });
  });

  it("escalates exactly at the limit", () => {
    expect(decideWarnEscalation(3, policy)).toEqual({
      escalate: true,
      mode: "tmute",
      durationMs: 3_600_000,
    });
  });

  it("escalates above the limit", () => {
    expect(decideWarnEscalation(5, policy)).toEqual({
      escalate: true,
      mode: "tmute",
      durationMs: 3_600_000,
    });
  });
});

describe("formatWarnPolicy", () => {
  it("formats the default policy without duration and without expiry", () => {
    const text = formatWarnPolicy(defaultWarnPolicy);
    expect(text).toContain("- Limite: 3");
    expect(text).toContain("- Modo: mute");
    expect(text).toContain("los warns no caducan");
    expect(text).not.toContain("Duracion sancion");
  });

  it("formats a timed policy with duration and expiry in days", () => {
    const text = formatWarnPolicy({
      limit: 5,
      mode: "tban",
      durationMs: 7_200_000,
      expireMs: 172_800_000,
    });
    expect(text).toContain("- Limite: 5");
    expect(text).toContain("- Modo: tban");
    expect(text).toContain("- Duracion sancion: 2h");
    expect(text).toContain("- Caducidad: 2d");
  });

  it("collapses a 7-day expiry into weeks", () => {
    const text = formatWarnPolicy({
      limit: 3,
      mode: "mute",
      durationMs: undefined,
      expireMs: 604_800_000,
    });
    expect(text).toContain("- Caducidad: 1w");
  });
});

describe("buildRemoveWarnButton", () => {
  it("builds an inline keyboard with the correct callback", () => {
    expect(buildRemoveWarnButton("abc123")).toEqual({
      inline_keyboard: [
        [
          {
            text: "❌ Quitar warn (admin)",
            callback_data: "warn:remove:abc123",
          },
        ],
      ],
    });
  });
});

describe("parseRemoveWarnCallback", () => {
  it("parses a valid callback", () => {
    expect(parseRemoveWarnCallback("warn:remove:xyz")).toEqual({
      warnId: "xyz",
    });
  });

  it("returns null for a callback without an id", () => {
    expect(parseRemoveWarnCallback("warn:remove:")).toBeNull();
  });

  it("returns null for a different prefix", () => {
    expect(parseRemoveWarnCallback("quiz:remove:xyz")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseRemoveWarnCallback(undefined)).toBeNull();
  });
});
