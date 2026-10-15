import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  matchByInterest,
  normalizeInterestTag,
  parseInterestCommand,
} from "./interest-tags.js";

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

describe("normalizeInterestTag", () => {
  it("lowercases and strips diacritics", () => {
    expect(normalizeInterestTag("Fútbol")).toBe("futbol");
    expect(normalizeInterestTag("MÚSICA")).toBe("musica");
  });

  it("joins words with a single hyphen", () => {
    expect(normalizeInterestTag("Futbol Sala")).toBe("futbol-sala");
    expect(normalizeInterestTag("  React   Native  ")).toBe("react-native");
  });

  it("collapses punctuation and underscores into one hyphen", () => {
    expect(normalizeInterestTag("React.js")).toBe("react-js");
    expect(normalizeInterestTag("board_games")).toBe("board-games");
    expect(normalizeInterestTag("c++ / rust")).toBe("c-rust");
  });

  it("trims leading and trailing hyphens", () => {
    expect(normalizeInterestTag("--cine--")).toBe("cine");
    expect(normalizeInterestTag("!!hola!!")).toBe("hola");
  });

  it("returns empty for symbol-only or empty input", () => {
    expect(normalizeInterestTag("")).toBe("");
    expect(normalizeInterestTag("   ")).toBe("");
    expect(normalizeInterestTag("***")).toBe("");
  });

  it("is deterministic and idempotent", () => {
    const once = normalizeInterestTag("Café Con Leche");
    expect(once).toBe("cafe-con-leche");
    expect(normalizeInterestTag(once)).toBe(once);
  });
});

describe("parseInterestCommand", () => {
  it("returns null when the command is absent or different", () => {
    expect(parseInterestCommand(baseUpdate())).toBeNull();
    expect(
      parseInterestCommand(baseUpdate({ command: cmd("afk") })),
    ).toBeNull();
  });

  it("parses list without extra args", () => {
    expect(
      parseInterestCommand(baseUpdate({ command: cmd("intereses", ["list"]) })),
    ).toEqual({ ok: true, command: { kind: "list" } });
  });

  it("parses list case-insensitively", () => {
    expect(
      parseInterestCommand(baseUpdate({ command: cmd("intereses", ["LIST"]) })),
    ).toEqual({ ok: true, command: { kind: "list" } });
  });

  it("parses add with a normalized tag", () => {
    expect(
      parseInterestCommand(
        baseUpdate({ command: cmd("intereses", ["add", "Fútbol", "Sala"]) }),
      ),
    ).toEqual({ ok: true, command: { kind: "add", tag: "futbol-sala" } });
  });

  it("parses remove with a normalized tag", () => {
    expect(
      parseInterestCommand(
        baseUpdate({ command: cmd("intereses", ["remove", "React.js"]) }),
      ),
    ).toEqual({ ok: true, command: { kind: "remove", tag: "react-js" } });
  });

  it("errors with usage on a missing subcommand", () => {
    const result = parseInterestCommand(
      baseUpdate({ command: cmd("intereses") }),
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: "usage",
        message: "Uso: /intereses add <interes> | remove <interes> | list",
      },
    });
  });

  it("errors with usage on an unknown subcommand", () => {
    const result = parseInterestCommand(
      baseUpdate({ command: cmd("intereses", ["borrar", "cine"]) }),
    );
    expect(result?.ok).toBe(false);
    if (result && !result.ok) {
      expect(result.error.code).toBe("usage");
    }
  });

  it("errors with empty-tag when add has no usable tag", () => {
    const result = parseInterestCommand(
      baseUpdate({ command: cmd("intereses", ["add", "***"]) }),
    );
    expect(result?.ok).toBe(false);
    if (result && !result.ok) {
      expect(result.error.code).toBe("empty-tag");
    }
  });

  it("errors with empty-tag when remove is missing the tag", () => {
    const result = parseInterestCommand(
      baseUpdate({ command: cmd("intereses", ["remove"]) }),
    );
    expect(result?.ok).toBe(false);
    if (result && !result.ok) {
      expect(result.error.code).toBe("empty-tag");
    }
  });
});

describe("matchByInterest", () => {
  it("counts shared tags and sorts descending", () => {
    const result = matchByInterest(
      ["futbol", "cine", "react"],
      [
        { userId: "a", tags: ["cine"] },
        { userId: "b", tags: ["futbol", "cine", "react"] },
        { userId: "c", tags: ["futbol", "react"] },
      ],
    );
    expect(result).toEqual([
      { userId: "b", shared: 3 },
      { userId: "c", shared: 2 },
      { userId: "a", shared: 1 },
    ]);
  });

  it("excludes candidates with no shared tags", () => {
    const result = matchByInterest(
      ["cine"],
      [
        { userId: "a", tags: ["futbol"] },
        { userId: "b", tags: ["cine"] },
      ],
    );
    expect(result).toEqual([{ userId: "b", shared: 1 }]);
  });

  it("matches through normalization on both sides", () => {
    const result = matchByInterest(
      ["Fútbol"],
      [{ userId: "a", tags: ["FUTBOL"] }],
    );
    expect(result).toEqual([{ userId: "a", shared: 1 }]);
  });

  it("deduplicates repeated tags before counting", () => {
    const result = matchByInterest(
      ["cine", "cine", "Cine"],
      [{ userId: "a", tags: ["cine", "cine"] }],
    );
    expect(result).toEqual([{ userId: "a", shared: 1 }]);
  });

  it("ignores empty or symbol-only tags", () => {
    const result = matchByInterest(
      ["cine", "***", ""],
      [{ userId: "a", tags: ["***", "cine"] }],
    );
    expect(result).toEqual([{ userId: "a", shared: 1 }]);
  });

  it("returns empty when the user has no usable tags", () => {
    expect(matchByInterest([], [{ userId: "a", tags: ["cine"] }])).toEqual([]);
    expect(matchByInterest(["***"], [{ userId: "a", tags: ["cine"] }])).toEqual(
      [],
    );
  });

  it("returns empty when there are no candidates", () => {
    expect(matchByInterest(["cine"], [])).toEqual([]);
  });

  it("preserves input order for equal shared counts", () => {
    const result = matchByInterest(
      ["cine", "futbol"],
      [
        { userId: "x", tags: ["cine"] },
        { userId: "y", tags: ["futbol"] },
      ],
    );
    expect(result).toEqual([
      { userId: "x", shared: 1 },
      { userId: "y", shared: 1 },
    ]);
  });

  it("is deterministic across repeated calls", () => {
    const args = [
      ["cine", "react"],
      [
        { userId: "a", tags: ["react"] },
        { userId: "b", tags: ["cine", "react"] },
      ],
    ] as const;
    expect(matchByInterest(args[0], args[1])).toEqual(
      matchByInterest(args[0], args[1]),
    );
  });
});
