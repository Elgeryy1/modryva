import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  dueRituals,
  formatRitual,
  isRitualDue,
  isRitualHour,
  isRitualWeekday,
  parseRitualCommand,
  type Ritual,
} from "./rituals.js";

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

const ritual = (overrides: Partial<Ritual> = {}): Ritual => ({
  weekday: 1,
  hour: 9,
  message: "Comparte tu pregunta",
  ...overrides,
});

describe("isRitualWeekday", () => {
  it("accepts integers 0..6", () => {
    expect(isRitualWeekday(0)).toBe(true);
    expect(isRitualWeekday(6)).toBe(true);
    expect(isRitualWeekday(3)).toBe(true);
  });

  it("rejects out-of-range and non-integer values", () => {
    expect(isRitualWeekday(-1)).toBe(false);
    expect(isRitualWeekday(7)).toBe(false);
    expect(isRitualWeekday(2.5)).toBe(false);
  });
});

describe("isRitualHour", () => {
  it("accepts integers 0..23", () => {
    expect(isRitualHour(0)).toBe(true);
    expect(isRitualHour(23)).toBe(true);
  });

  it("rejects out-of-range and non-integer values", () => {
    expect(isRitualHour(-1)).toBe(false);
    expect(isRitualHour(24)).toBe(false);
    expect(isRitualHour(9.1)).toBe(false);
  });
});

describe("isRitualDue", () => {
  it("is true only when weekday and hour both match", () => {
    const r = ritual({ weekday: 1, hour: 9 });
    expect(isRitualDue(r, 1, 9)).toBe(true);
    expect(isRitualDue(r, 1, 10)).toBe(false);
    expect(isRitualDue(r, 2, 9)).toBe(false);
  });

  it("never fires for a ritual with invalid weekday or hour", () => {
    expect(isRitualDue(ritual({ weekday: 9 }), 9, 9)).toBe(false);
    expect(isRitualDue(ritual({ hour: 30 }), 1, 30)).toBe(false);
  });
});

describe("dueRituals", () => {
  it("returns rituals matching the target time in input order", () => {
    const list = [
      ritual({ weekday: 1, hour: 9, message: "a" }),
      ritual({ weekday: 5, hour: 20, message: "b" }),
      ritual({ weekday: 1, hour: 9, message: "c" }),
    ];
    expect(dueRituals(list, 1, 9)).toEqual([list[0], list[2]]);
  });

  it("returns empty when nothing matches", () => {
    const list = [ritual({ weekday: 1, hour: 9 })];
    expect(dueRituals(list, 2, 9)).toEqual([]);
  });

  it("returns empty for an invalid target weekday or hour", () => {
    const list = [ritual({ weekday: 1, hour: 9 })];
    expect(dueRituals(list, 7, 9)).toEqual([]);
    expect(dueRituals(list, 1, 24)).toEqual([]);
  });

  it("is deterministic across repeated calls", () => {
    const list = [ritual({ weekday: 3, hour: 12 })];
    expect(dueRituals(list, 3, 12)).toEqual(dueRituals(list, 3, 12));
  });
});

describe("formatRitual", () => {
  it("labels the weekday in Spanish and zero-pads the hour", () => {
    expect(
      formatRitual(ritual({ weekday: 1, hour: 9, message: "Preguntas" })),
    ).toBe("lunes 09:00 -> Preguntas");
  });

  it("falls back to the numeric weekday when out of range", () => {
    expect(formatRitual(ritual({ weekday: 9, hour: 8, message: "x" }))).toBe(
      "9 08:00 -> x",
    );
  });
});

describe("parseRitualCommand", () => {
  it("returns null when the command is not /ritual", () => {
    expect(parseRitualCommand(baseUpdate({ command: cmd("afk") }))).toBeNull();
    expect(parseRitualCommand(baseUpdate())).toBeNull();
  });

  it("errors on a missing subcommand", () => {
    const result = parseRitualCommand(baseUpdate({ command: cmd("ritual") }));
    expect(result).toEqual({
      ok: false,
      error: {
        code: "missing-subcommand",
        usage: "Uso: /ritual add|list|remove",
      },
    });
  });

  it("errors on an unknown subcommand", () => {
    const result = parseRitualCommand(
      baseUpdate({ command: cmd("ritual", ["nope"]) }),
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: "unknown-subcommand",
        usage: "Uso: /ritual add|list|remove",
      },
    });
  });

  it("parses list without arguments", () => {
    expect(
      parseRitualCommand(baseUpdate({ command: cmd("ritual", ["list"]) })),
    ).toEqual({ ok: true, command: { kind: "list" } });
  });

  it("is case-insensitive on the subcommand", () => {
    expect(
      parseRitualCommand(baseUpdate({ command: cmd("ritual", ["LIST"]) })),
    ).toEqual({ ok: true, command: { kind: "list" } });
  });

  it("parses add joining the remaining args as the message", () => {
    expect(
      parseRitualCommand(
        baseUpdate({
          command: cmd("ritual", [
            "add",
            "1",
            "9",
            "Comparte",
            "tu",
            "pregunta",
          ]),
        }),
      ),
    ).toEqual({
      ok: true,
      command: {
        kind: "add",
        ritual: { weekday: 1, hour: 9, message: "Comparte tu pregunta" },
      },
    });
  });

  it("errors when add lacks numeric weekday or hour", () => {
    const result = parseRitualCommand(
      baseUpdate({ command: cmd("ritual", ["add", "lunes", "9", "x"]) }),
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: "missing-args",
        usage: "Uso: /ritual add <dia 0-6> <hora 0-23> <mensaje>",
      },
    });
  });

  it("errors when add weekday is out of range", () => {
    const result = parseRitualCommand(
      baseUpdate({ command: cmd("ritual", ["add", "7", "9", "x"]) }),
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid-weekday",
        usage: "Uso: /ritual add <dia 0-6> <hora 0-23> <mensaje>",
      },
    });
  });

  it("errors when add hour is out of range", () => {
    const result = parseRitualCommand(
      baseUpdate({ command: cmd("ritual", ["add", "1", "24", "x"]) }),
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid-hour",
        usage: "Uso: /ritual add <dia 0-6> <hora 0-23> <mensaje>",
      },
    });
  });

  it("errors when add has no message", () => {
    const result = parseRitualCommand(
      baseUpdate({ command: cmd("ritual", ["add", "1", "9"]) }),
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: "missing-message",
        usage: "Uso: /ritual add <dia 0-6> <hora 0-23> <mensaje>",
      },
    });
  });

  it("treats a whitespace-only message as missing", () => {
    const result = parseRitualCommand(
      baseUpdate({ command: cmd("ritual", ["add", "1", "9", "   "]) }),
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: "missing-message",
        usage: "Uso: /ritual add <dia 0-6> <hora 0-23> <mensaje>",
      },
    });
  });

  it("parses remove with weekday and hour", () => {
    expect(
      parseRitualCommand(
        baseUpdate({ command: cmd("ritual", ["remove", "5", "20"]) }),
      ),
    ).toEqual({ ok: true, command: { kind: "remove", weekday: 5, hour: 20 } });
  });

  it("errors when remove lacks numeric args", () => {
    const result = parseRitualCommand(
      baseUpdate({ command: cmd("ritual", ["remove", "5"]) }),
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: "missing-args",
        usage: "Uso: /ritual remove <dia 0-6> <hora 0-23>",
      },
    });
  });
});
