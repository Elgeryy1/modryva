import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  type AfkUser,
  buildAfkClearReply,
  buildAfkNotice,
  buildAfkSetReply,
  extractMentions,
  findMentionedAfkUsers,
  formatAfkDuration,
  parseAfkCommand,
} from "./afk.js";

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

const afkUser = (overrides: Partial<AfkUser> = {}): AfkUser => ({
  telegramUserId: 7n,
  username: "tester",
  reason: undefined,
  sinceMs: 0,
  ...overrides,
});

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("parseAfkCommand", () => {
  it("parses /afk without motivo as set with undefined reason", () => {
    expect(parseAfkCommand(baseUpdate({ command: cmd("afk") }))).toEqual({
      ok: true,
      command: { kind: "set", reason: undefined },
    });
  });

  it("parses /afk with motivo joining all args", () => {
    expect(
      parseAfkCommand(
        baseUpdate({ command: cmd("afk", ["comiendo", "algo"]) }),
      ),
    ).toEqual({
      ok: true,
      command: { kind: "set", reason: "comiendo algo" },
    });
  });

  it("treats whitespace-only motivo as no motivo", () => {
    expect(
      parseAfkCommand(baseUpdate({ command: cmd("afk", ["  ", ""]) })),
    ).toEqual({
      ok: true,
      command: { kind: "set", reason: undefined },
    });
  });

  it("parses /back as clear", () => {
    expect(parseAfkCommand(baseUpdate({ command: cmd("back") }))).toEqual({
      ok: true,
      command: { kind: "clear" },
    });
  });

  it("parses the /unafk alias as clear", () => {
    expect(parseAfkCommand(baseUpdate({ command: cmd("unafk") }))).toEqual({
      ok: true,
      command: { kind: "clear" },
    });
  });

  it("returns null for other commands or no command", () => {
    expect(parseAfkCommand(baseUpdate({ command: cmd("ban") }))).toBeNull();
    expect(parseAfkCommand(baseUpdate())).toBeNull();
  });
});

describe("extractMentions", () => {
  it("extracts multiple mentions in order", () => {
    expect(extractMentions("hola @Ana_99 y @bob_smith que tal")).toEqual([
      "ana_99",
      "bob_smith",
    ]);
  });

  it("lowercases and deduplicates mentions", () => {
    expect(extractMentions("@Tester @TESTER @tester")).toEqual(["tester"]);
  });

  it("returns empty for text without mentions", () => {
    expect(extractMentions("sin menciones aqui")).toEqual([]);
  });

  it("returns empty for undefined text", () => {
    expect(extractMentions(undefined)).toEqual([]);
  });

  it("ignores usernames shorter than 3 characters", () => {
    expect(extractMentions("hola @ab y @abc")).toEqual(["abc"]);
  });
});

describe("findMentionedAfkUsers", () => {
  it("matches mentioned usernames case-insensitively", () => {
    const users = [
      afkUser({ telegramUserId: 1n, username: "Alice" }),
      afkUser({ telegramUserId: 2n, username: "bob" }),
      afkUser({ telegramUserId: 3n, username: "carol" }),
    ];
    expect(findMentionedAfkUsers("@ALICE mira esto con @Bob", users)).toEqual([
      users[0],
      users[1],
    ]);
  });

  it("never matches AFK users without username", () => {
    const users = [
      afkUser({ telegramUserId: 1n, username: undefined }),
      afkUser({ telegramUserId: 2n, username: "bob" }),
    ];
    expect(findMentionedAfkUsers("@bob y @undefined", users)).toEqual([
      users[1],
    ]);
  });

  it("returns empty when the text has no mentions or is undefined", () => {
    const users = [afkUser({ username: "bob" })];
    expect(findMentionedAfkUsers("sin menciones", users)).toEqual([]);
    expect(findMentionedAfkUsers(undefined, users)).toEqual([]);
  });
});

describe("formatAfkDuration", () => {
  it("returns <1m for less than a minute and for negatives", () => {
    expect(formatAfkDuration(0)).toBe("<1m");
    expect(formatAfkDuration(59_999)).toBe("<1m");
    expect(formatAfkDuration(-5 * MINUTE)).toBe("<1m");
  });

  it("formats whole minutes under an hour", () => {
    expect(formatAfkDuration(MINUTE)).toBe("1m");
    expect(formatAfkDuration(5 * MINUTE)).toBe("5m");
    expect(formatAfkDuration(59 * MINUTE + 59_000)).toBe("59m");
  });

  it("formats hours with remaining minutes", () => {
    expect(formatAfkDuration(2 * HOUR + 3 * MINUTE)).toBe("2h 3m");
    expect(formatAfkDuration(HOUR + MINUTE)).toBe("1h 1m");
  });

  it("omits the minute part on exact hours", () => {
    expect(formatAfkDuration(2 * HOUR)).toBe("2h");
  });

  it("formats days with remaining hours", () => {
    expect(formatAfkDuration(DAY + 4 * HOUR)).toBe("1d 4h");
    expect(formatAfkDuration(3 * DAY + HOUR + 30 * MINUTE)).toBe("3d 1h");
  });

  it("omits the hour part on exact days", () => {
    expect(formatAfkDuration(2 * DAY)).toBe("2d");
  });
});

describe("buildAfkNotice", () => {
  it("includes username, duration and motivo", () => {
    const user = afkUser({
      username: "ana",
      reason: "almorzando",
      sinceMs: 0,
    });
    expect(buildAfkNotice(user, 2 * HOUR + 3 * MINUTE)).toBe(
      "💤 @ana esta AFK desde hace 2h 3m: almorzando",
    );
  });

  it("omits the colon part without motivo", () => {
    const user = afkUser({ username: "ana", sinceMs: 0 });
    expect(buildAfkNotice(user, 5 * MINUTE)).toBe(
      "💤 @ana esta AFK desde hace 5m",
    );
  });

  it("uses 'ese usuario' without username", () => {
    const user = afkUser({ username: undefined, sinceMs: 0 });
    expect(buildAfkNotice(user, DAY + 4 * HOUR)).toBe(
      "💤 ese usuario esta AFK desde hace 1d 4h",
    );
  });

  it("is deterministic for identical inputs", () => {
    const user = afkUser({ username: "ana", reason: "x", sinceMs: 1_000 });
    expect(buildAfkNotice(user, 10 * MINUTE)).toBe(
      buildAfkNotice(user, 10 * MINUTE),
    );
  });
});

describe("buildAfkSetReply", () => {
  it("includes the motivo when given", () => {
    expect(buildAfkSetReply("descansando")).toBe(
      "💤 Marcado como AFK: descansando",
    );
  });

  it("omits the motivo when undefined", () => {
    expect(buildAfkSetReply(undefined)).toBe("💤 Marcado como AFK.");
  });
});

describe("buildAfkClearReply", () => {
  it("reports the elapsed AFK duration", () => {
    expect(buildAfkClearReply(0, 2 * HOUR + 3 * MINUTE)).toBe(
      "👋 Bienvenido de vuelta! Estuviste AFK 2h 3m.",
    );
  });

  it("reports <1m for very short absences", () => {
    expect(buildAfkClearReply(1_000, 30_000)).toBe(
      "👋 Bienvenido de vuelta! Estuviste AFK <1m.",
    );
  });
});
