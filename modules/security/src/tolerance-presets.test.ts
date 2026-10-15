import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  formatTolerancePreset,
  isToleranceLevel,
  parseToleranceCommand,
  resolveTolerancePreset,
  TOLERANCE_LEVELS,
  type ToleranceLevel,
} from "./tolerance-presets.js";

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

describe("TOLERANCE_LEVELS", () => {
  it("lists the four levels from laxest to strictest", () => {
    expect(TOLERANCE_LEVELS).toEqual([
      "suave",
      "normal",
      "estricto",
      "nuclear",
    ]);
  });
});

describe("resolveTolerancePreset", () => {
  it("returns a laxer preset for suave than for nuclear", () => {
    const suave = resolveTolerancePreset("suave");
    const nuclear = resolveTolerancePreset("nuclear");
    expect(suave.antiflood.messageLimit).toBeGreaterThan(
      nuclear.antiflood.messageLimit,
    );
    expect(suave.antiraid.joinLimit).toBeGreaterThan(
      nuclear.antiraid.joinLimit,
    );
    expect(suave.warn.limit).toBeGreaterThan(nuclear.warn.limit);
  });

  it("has monotonically decreasing flood/raid/warn limits across levels", () => {
    const presets = TOLERANCE_LEVELS.map(resolveTolerancePreset);
    for (let i = 1; i < presets.length; i += 1) {
      const prev = presets[i - 1];
      const curr = presets[i];
      if (!prev || !curr) {
        continue;
      }
      expect(curr.antiflood.messageLimit).toBeLessThanOrEqual(
        prev.antiflood.messageLimit,
      );
      expect(curr.antiraid.joinLimit).toBeLessThanOrEqual(
        prev.antiraid.joinLimit,
      );
      expect(curr.warn.limit).toBeLessThanOrEqual(prev.warn.limit);
    }
  });

  it("enables captcha only for the stricter halves", () => {
    expect(resolveTolerancePreset("suave").captchaOn).toBe(false);
    expect(resolveTolerancePreset("normal").captchaOn).toBe(false);
    expect(resolveTolerancePreset("estricto").captchaOn).toBe(true);
    expect(resolveTolerancePreset("nuclear").captchaOn).toBe(true);
  });

  it("escalates antiraid from observe to enforce", () => {
    expect(resolveTolerancePreset("suave").antiraid.mode).toBe("observe");
    expect(resolveTolerancePreset("normal").antiraid.mode).toBe("observe");
    expect(resolveTolerancePreset("estricto").antiraid.mode).toBe("enforce");
    expect(resolveTolerancePreset("nuclear").antiraid.mode).toBe("enforce");
  });

  it("uses ban as the antiflood action only at nuclear", () => {
    expect(resolveTolerancePreset("nuclear").antiflood.action).toBe("ban");
    expect(resolveTolerancePreset("suave").antiflood.action).not.toBe("ban");
  });

  it("keeps positive windows and limits for every level", () => {
    for (const level of TOLERANCE_LEVELS) {
      const preset = resolveTolerancePreset(level);
      expect(preset.antiflood.messageLimit).toBeGreaterThan(0);
      expect(preset.antiflood.windowSeconds).toBeGreaterThan(0);
      expect(preset.antiraid.joinLimit).toBeGreaterThan(0);
      expect(preset.antiraid.windowSeconds).toBeGreaterThan(0);
      expect(preset.warn.limit).toBeGreaterThan(0);
    }
  });

  it("is deterministic: same reference on repeated calls", () => {
    expect(resolveTolerancePreset("normal")).toBe(
      resolveTolerancePreset("normal"),
    );
  });
});

describe("isToleranceLevel", () => {
  it("accepts every known level", () => {
    for (const level of TOLERANCE_LEVELS) {
      expect(isToleranceLevel(level)).toBe(true);
    }
  });

  it("rejects unknown or empty values", () => {
    expect(isToleranceLevel("medio")).toBe(false);
    expect(isToleranceLevel("")).toBe(false);
    expect(isToleranceLevel("SUAVE")).toBe(false);
  });
});

describe("parseToleranceCommand", () => {
  it("parses a valid level", () => {
    expect(
      parseToleranceCommand(
        baseUpdate({ command: cmd("tolerance", ["estricto"]) }),
      ),
    ).toEqual({ ok: true, command: { level: "estricto" } });
  });

  it("lowercases the level argument", () => {
    expect(
      parseToleranceCommand(
        baseUpdate({ command: cmd("tolerance", ["NUCLEAR"]) }),
      ),
    ).toEqual({ ok: true, command: { level: "nuclear" } });
  });

  it("returns missing-level error when no argument is given", () => {
    const result = parseToleranceCommand(
      baseUpdate({ command: cmd("tolerance") }),
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: "missing-level",
        usage: "Uso: /tolerance suave|normal|estricto|nuclear",
      },
    });
  });

  it("returns unknown-level error for an unrecognized level", () => {
    const result = parseToleranceCommand(
      baseUpdate({ command: cmd("tolerance", ["medio"]) }),
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: "unknown-level",
        usage: "Uso: /tolerance suave|normal|estricto|nuclear",
      },
    });
  });

  it("returns null for other commands or no command", () => {
    expect(
      parseToleranceCommand(baseUpdate({ command: cmd("ban") })),
    ).toBeNull();
    expect(parseToleranceCommand(baseUpdate())).toBeNull();
  });
});

describe("formatTolerancePreset", () => {
  it("summarizes suave with captcha OFF and observe mode", () => {
    const summary = formatTolerancePreset("suave");
    expect(summary).toContain("Suave");
    expect(summary).toContain("captcha OFF");
    expect(summary).toContain("observe");
  });

  it("summarizes nuclear with captcha ON and ban action", () => {
    const summary = formatTolerancePreset("nuclear");
    expect(summary).toContain("Nuclear");
    expect(summary).toContain("captcha ON");
    expect(summary).toContain("(ban)");
    expect(summary).toContain("enforce");
  });

  it("reflects the resolved numeric thresholds", () => {
    const preset = resolveTolerancePreset("normal");
    const summary = formatTolerancePreset("normal");
    expect(summary).toContain(`${preset.antiflood.messageLimit} msg`);
    expect(summary).toContain(`warns ${preset.warn.limit}`);
  });

  it("produces a non-empty single-line summary for every level", () => {
    for (const level of TOLERANCE_LEVELS satisfies readonly ToleranceLevel[]) {
      const summary = formatTolerancePreset(level);
      expect(summary.length).toBeGreaterThan(0);
      expect(summary).not.toContain("\n");
    }
  });
});
