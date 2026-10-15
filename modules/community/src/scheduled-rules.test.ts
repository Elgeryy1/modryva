import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  activeTimeRule,
  formatTimeRuleWindow,
  isStrictAtHour,
  isTimeRuleActive,
  parseScheduledRuleCommand,
  type TimeRule,
} from "./scheduled-rules.js";

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

const rule = (overrides: Partial<TimeRule> = {}): TimeRule => ({
  startHour: 22,
  endHour: 6,
  strict: true,
  ...overrides,
});

describe("isTimeRuleActive", () => {
  it("matches inside a same-day window (half-open)", () => {
    const day = rule({ startHour: 9, endHour: 17 });
    expect(isTimeRuleActive(day, 9)).toBe(true);
    expect(isTimeRuleActive(day, 12)).toBe(true);
    expect(isTimeRuleActive(day, 16)).toBe(true);
  });

  it("excludes the end hour and hours outside a same-day window", () => {
    const day = rule({ startHour: 9, endHour: 17 });
    expect(isTimeRuleActive(day, 17)).toBe(false);
    expect(isTimeRuleActive(day, 8)).toBe(false);
    expect(isTimeRuleActive(day, 23)).toBe(false);
  });

  it("matches across midnight when start > end", () => {
    const night = rule({ startHour: 22, endHour: 6 });
    expect(isTimeRuleActive(night, 22)).toBe(true);
    expect(isTimeRuleActive(night, 23)).toBe(true);
    expect(isTimeRuleActive(night, 0)).toBe(true);
    expect(isTimeRuleActive(night, 5)).toBe(true);
  });

  it("excludes the end hour and the daytime gap of a midnight window", () => {
    const night = rule({ startHour: 22, endHour: 6 });
    expect(isTimeRuleActive(night, 6)).toBe(false);
    expect(isTimeRuleActive(night, 12)).toBe(false);
    expect(isTimeRuleActive(night, 21)).toBe(false);
  });

  it("treats start === end as an all-day window", () => {
    const allDay = rule({ startHour: 0, endHour: 0 });
    expect(isTimeRuleActive(allDay, 0)).toBe(true);
    expect(isTimeRuleActive(allDay, 13)).toBe(true);
    expect(isTimeRuleActive(allDay, 23)).toBe(true);
  });

  it("never matches when the rule hours are out of range", () => {
    expect(isTimeRuleActive(rule({ startHour: -1, endHour: 6 }), 0)).toBe(
      false,
    );
    expect(isTimeRuleActive(rule({ startHour: 22, endHour: 24 }), 23)).toBe(
      false,
    );
  });

  it("never matches for a non-integer or out-of-range hour", () => {
    const night = rule({ startHour: 22, endHour: 6 });
    expect(isTimeRuleActive(night, 23.5)).toBe(false);
    expect(isTimeRuleActive(night, 24)).toBe(false);
    expect(isTimeRuleActive(night, -1)).toBe(false);
  });
});

describe("activeTimeRule", () => {
  it("returns the first active rule in priority order", () => {
    const rules = [
      rule({ startHour: 0, endHour: 8, strict: true }),
      rule({ startHour: 0, endHour: 12, strict: false }),
    ];
    expect(activeTimeRule(rules, 5)).toBe(rules[0]);
  });

  it("falls through to a later rule when earlier ones do not apply", () => {
    const rules = [
      rule({ startHour: 22, endHour: 6, strict: true }),
      rule({ startHour: 9, endHour: 17, strict: false }),
    ];
    expect(activeTimeRule(rules, 12)).toBe(rules[1]);
  });

  it("returns null when no rule applies", () => {
    const rules = [rule({ startHour: 22, endHour: 6 })];
    expect(activeTimeRule(rules, 12)).toBeNull();
  });

  it("returns null for an empty rule list", () => {
    expect(activeTimeRule([], 3)).toBeNull();
  });

  it("is deterministic for identical inputs", () => {
    const rules = [rule({ startHour: 22, endHour: 6 })];
    expect(activeTimeRule(rules, 23)).toBe(activeTimeRule(rules, 23));
  });
});

describe("isStrictAtHour", () => {
  it("is true when the active rule is strict", () => {
    const rules = [rule({ startHour: 22, endHour: 6, strict: true })];
    expect(isStrictAtHour(rules, 2)).toBe(true);
  });

  it("is false when the active rule is not strict", () => {
    const rules = [rule({ startHour: 9, endHour: 17, strict: false })];
    expect(isStrictAtHour(rules, 10)).toBe(false);
  });

  it("is false when no rule applies", () => {
    const rules = [rule({ startHour: 22, endHour: 6, strict: true })];
    expect(isStrictAtHour(rules, 12)).toBe(false);
  });
});

describe("formatTimeRuleWindow", () => {
  it("zero-pads single-digit hours", () => {
    expect(formatTimeRuleWindow(rule({ startHour: 22, endHour: 6 }))).toBe(
      "22:00-06:00",
    );
  });

  it("formats a same-day window", () => {
    expect(formatTimeRuleWindow(rule({ startHour: 9, endHour: 17 }))).toBe(
      "09:00-17:00",
    );
  });
});

describe("parseScheduledRuleCommand", () => {
  it("parses hours and an on toggle into a strict command", () => {
    expect(
      parseScheduledRuleCommand(
        baseUpdate({ command: cmd("schedulerule", ["22", "6", "on"]) }),
      ),
    ).toEqual({
      ok: true,
      command: { startHour: 22, endHour: 6, strict: true },
    });
  });

  it("parses an off toggle into a non-strict command", () => {
    expect(
      parseScheduledRuleCommand(
        baseUpdate({ command: cmd("schedulerule", ["9", "17", "off"]) }),
      ),
    ).toEqual({
      ok: true,
      command: { startHour: 9, endHour: 17, strict: false },
    });
  });

  it("accepts alternative toggle spellings", () => {
    const result = parseScheduledRuleCommand(
      baseUpdate({ command: cmd("schedulerule", ["0", "0", "si"]) }),
    );
    expect(result).toEqual({
      ok: true,
      command: { startHour: 0, endHour: 0, strict: true },
    });
  });

  it("returns a usage error when args are missing", () => {
    const result = parseScheduledRuleCommand(
      baseUpdate({ command: cmd("schedulerule", ["22", "6"]) }),
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: "usage",
        message: "Uso: /schedulerule <horaInicio 0-23> <horaFin 0-23> on|off",
      },
    });
  });

  it("returns an invalid-hour error for out-of-range hours", () => {
    const result = parseScheduledRuleCommand(
      baseUpdate({ command: cmd("schedulerule", ["24", "6", "on"]) }),
    );
    expect(result?.ok).toBe(false);
    if (result && !result.ok) {
      expect(result.error.code).toBe("invalid-hour");
    }
  });

  it("returns an invalid-hour error for non-numeric hours", () => {
    const result = parseScheduledRuleCommand(
      baseUpdate({ command: cmd("schedulerule", ["dos", "6", "on"]) }),
    );
    expect(result?.ok).toBe(false);
    if (result && !result.ok) {
      expect(result.error.code).toBe("invalid-hour");
    }
  });

  it("returns an invalid-toggle error for an unknown toggle", () => {
    const result = parseScheduledRuleCommand(
      baseUpdate({ command: cmd("schedulerule", ["22", "6", "maybe"]) }),
    );
    expect(result?.ok).toBe(false);
    if (result && !result.ok) {
      expect(result.error.code).toBe("invalid-toggle");
    }
  });

  it("returns null for other commands and for no command", () => {
    expect(
      parseScheduledRuleCommand(baseUpdate({ command: cmd("ban") })),
    ).toBeNull();
    expect(parseScheduledRuleCommand(baseUpdate())).toBeNull();
  });
});
