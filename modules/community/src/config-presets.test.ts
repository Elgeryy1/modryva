import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  CONFIG_MODES,
  type ConfigMode,
  detectConfigContradictions,
  expandConfigMode,
  isConfigMode,
  parseConfigModeCommand,
} from "./config-presets.js";

const baseUpdate = (
  overrides: Partial<TelegramUpdateEnvelope> = {},
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
  ...overrides,
});

const cmd = (
  name: string,
  args: readonly string[] = [],
): TelegramUpdateEnvelope["command"] => ({
  name,
  raw: args.length > 0 ? `/${name} ${args.join(" ")}` : `/${name}`,
  args,
});

describe("CONFIG_MODES", () => {
  it("lists the six supported modes in order", () => {
    expect(CONFIG_MODES).toEqual([
      "principiante",
      "avanzado",
      "vacaciones",
      "aula",
      "evento",
      "directo",
    ]);
  });
});

describe("isConfigMode", () => {
  it("accepts every declared mode", () => {
    for (const mode of CONFIG_MODES) {
      expect(isConfigMode(mode)).toBe(true);
    }
  });

  it("rejects unknown or empty values", () => {
    expect(isConfigMode("turbo")).toBe(false);
    expect(isConfigMode("")).toBe(false);
    expect(isConfigMode("Avanzado")).toBe(false);
  });
});

describe("expandConfigMode", () => {
  it("returns concrete overrides for a mode", () => {
    const overrides = expandConfigMode("avanzado");
    expect(overrides.captcha).toBe(true);
    expect(overrides.lockUrl).toBe(true);
    expect(overrides.allowLinks).toBe(false);
    expect(overrides.warnLimit).toBe(2);
  });

  it("returns overrides for every mode without throwing", () => {
    for (const mode of CONFIG_MODES) {
      expect(Object.keys(expandConfigMode(mode)).length).toBeGreaterThan(0);
    }
  });

  it("gives a fresh, independently mutable object per call", () => {
    const a = expandConfigMode("principiante") as Record<string, unknown>;
    const b = expandConfigMode("principiante");
    expect(a).not.toBe(b);
    a.antiSpam = false;
    expect(b.antiSpam).toBe(true);
  });

  it("is deterministic for identical inputs", () => {
    expect(expandConfigMode("aula")).toEqual(expandConfigMode("aula"));
  });

  it("keeps modes free of self-contradictory link settings", () => {
    for (const mode of CONFIG_MODES) {
      const o = expandConfigMode(mode);
      if (o.allowLinks === true) {
        expect(o.lockUrl).not.toBe(true);
      }
    }
  });

  it("carries a welcome string for the evento mode", () => {
    expect(expandConfigMode("evento").welcome).toBe("Bienvenido al evento!");
  });
});

describe("detectConfigContradictions", () => {
  it("flags allowLinks together with lockUrl", () => {
    const messages = detectConfigContradictions({
      allowLinks: true,
      lockUrl: true,
    });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("allowLinks");
    expect(messages[0]).toContain("lockUrl");
  });

  it("returns empty when only one of the pair is active", () => {
    expect(
      detectConfigContradictions({ allowLinks: true, lockUrl: false }),
    ).toEqual([]);
    expect(
      detectConfigContradictions({ allowLinks: false, lockUrl: true }),
    ).toEqual([]);
  });

  it("returns empty for an empty config", () => {
    expect(detectConfigContradictions({})).toEqual([]);
  });

  it("treats missing keys as not active", () => {
    expect(detectConfigContradictions({ lockUrl: true })).toEqual([]);
  });

  it("detects several contradictions in the fixed rule order", () => {
    const messages = detectConfigContradictions({
      allowLinks: true,
      lockUrl: true,
      captcha: true,
      autoApprove: true,
    });
    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain("allowLinks");
    expect(messages[1]).toContain("captcha");
  });

  it("flags captcha together with autoApprove", () => {
    const messages = detectConfigContradictions({
      captcha: true,
      autoApprove: true,
    });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("autoApprove");
  });

  it("is deterministic for identical inputs", () => {
    const config = { readOnly: true, allowLinks: true };
    expect(detectConfigContradictions(config)).toEqual(
      detectConfigContradictions(config),
    );
  });
});

describe("parseConfigModeCommand", () => {
  it("parses /modo <name> for a valid mode", () => {
    expect(
      parseConfigModeCommand(
        baseUpdate({ command: cmd("modo", ["avanzado"]) }),
      ),
    ).toEqual({ ok: true, command: { mode: "avanzado" } });
  });

  it("accepts the /preset alias", () => {
    expect(
      parseConfigModeCommand(baseUpdate({ command: cmd("preset", ["aula"]) })),
    ).toEqual({ ok: true, command: { mode: "aula" } });
  });

  it("is case-insensitive and trims the mode name", () => {
    expect(
      parseConfigModeCommand(
        baseUpdate({ command: cmd("modo", ["  EVENTO  "]) }),
      ),
    ).toEqual({ ok: true, command: { mode: "evento" } });
  });

  it("errors with missing-mode when no argument is given", () => {
    const result = parseConfigModeCommand(baseUpdate({ command: cmd("modo") }));
    expect(result).toEqual({
      ok: false,
      error: { code: "missing-mode", usage: expect.any(String) },
    });
  });

  it("errors with unknown-mode for an unsupported name", () => {
    const result = parseConfigModeCommand(
      baseUpdate({ command: cmd("modo", ["turbo"]) }),
    );
    expect(result).toEqual({
      ok: false,
      error: { code: "unknown-mode", usage: expect.any(String) },
    });
  });

  it("returns null for other commands or no command", () => {
    expect(
      parseConfigModeCommand(baseUpdate({ command: cmd("ban") })),
    ).toBeNull();
    expect(parseConfigModeCommand(baseUpdate())).toBeNull();
  });

  it("round-trips a parsed mode through expandConfigMode", () => {
    const result = parseConfigModeCommand(
      baseUpdate({ command: cmd("modo", ["vacaciones"]) }),
    );
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      const mode: ConfigMode = result.command.mode;
      expect(expandConfigMode(mode).captcha).toBe(true);
    }
  });
});
