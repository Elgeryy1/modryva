import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  type BlocklistEntry,
  matchBlocklist,
  normalizeBlocklistTrigger,
  parseBlocklistCommand,
} from "./blocklists.js";

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

const cmd = (name: string, args: readonly string[]) => ({
  name,
  raw: `/${name} ${args.join(" ")}`,
  args,
});

describe("parseBlocklistCommand", () => {
  it("returns null for commands outside the module", () => {
    expect(parseBlocklistCommand(baseUpdate())).toBeNull();
    expect(
      parseBlocklistCommand(baseUpdate({ command: cmd("ban", []) })),
    ).toBeNull();
    expect(
      parseBlocklistCommand(baseUpdate({ command: cmd("lock", ["text"]) })),
    ).toBeNull();
  });

  it("parses addblocklist with a single word and no reason", () => {
    expect(
      parseBlocklistCommand(
        baseUpdate({ command: cmd("addblocklist", ["spam"]) }),
      ),
    ).toEqual({
      ok: true,
      command: { kind: "add", trigger: "spam", reason: undefined },
    });
  });

  it("parses addblocklist with a word and a reason", () => {
    expect(
      parseBlocklistCommand(
        baseUpdate({ command: cmd("addblocklist", ["spam", "no", "vale"]) }),
      ),
    ).toEqual({
      ok: true,
      command: { kind: "add", trigger: "spam", reason: "no vale" },
    });
  });

  it("parses addblocklist with a quoted phrase as trigger", () => {
    expect(
      parseBlocklistCommand(
        baseUpdate({
          command: cmd("addblocklist", ['"vende', 'seguidores"']),
        }),
      ),
    ).toEqual({
      ok: true,
      command: {
        kind: "add",
        trigger: "vende seguidores",
        reason: undefined,
      },
    });
  });

  it("parses addblocklist with a quoted phrase plus a trailing reason", () => {
    expect(
      parseBlocklistCommand(
        baseUpdate({
          command: cmd("addblocklist", ['"vende', 'seguidores"', "publicidad"]),
        }),
      ),
    ).toEqual({
      ok: true,
      command: {
        kind: "add",
        trigger: "vende seguidores",
        reason: "publicidad",
      },
    });
  });

  it("rejects addblocklist without a trigger", () => {
    const result = parseBlocklistCommand(
      baseUpdate({ command: cmd("addblocklist", []) }),
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: "trigger-required" },
    });
    if (result && !result.ok) {
      expect(result.error.usage).toContain("/addblocklist");
    }
  });

  it("parses blocklist as a list command", () => {
    expect(
      parseBlocklistCommand(baseUpdate({ command: cmd("blocklist", []) })),
    ).toEqual({ ok: true, command: { kind: "list" } });
  });

  it("parses rmblocklist with a trigger", () => {
    expect(
      parseBlocklistCommand(
        baseUpdate({ command: cmd("rmblocklist", ["spam"]) }),
      ),
    ).toEqual({ ok: true, command: { kind: "remove", trigger: "spam" } });
  });

  it("parses rmblocklist with a quoted phrase trigger", () => {
    expect(
      parseBlocklistCommand(
        baseUpdate({
          command: cmd("rmblocklist", ['"vende', 'seguidores"']),
        }),
      ),
    ).toEqual({
      ok: true,
      command: { kind: "remove", trigger: "vende seguidores" },
    });
  });

  it("parses rmallblocklist as removeAll", () => {
    expect(
      parseBlocklistCommand(baseUpdate({ command: cmd("rmallblocklist", []) })),
    ).toEqual({ ok: true, command: { kind: "removeAll" } });
  });

  it("parses blocklistmode with each valid mode", () => {
    for (const mode of ["delete", "warn", "mute", "ban", "kick"] as const) {
      expect(
        parseBlocklistCommand(
          baseUpdate({ command: cmd("blocklistmode", [mode]) }),
        ),
      ).toEqual({ ok: true, command: { kind: "setMode", mode } });
    }
  });

  it("parses blocklistmode case-insensitively", () => {
    expect(
      parseBlocklistCommand(
        baseUpdate({ command: cmd("blocklistmode", ["BAN"]) }),
      ),
    ).toEqual({ ok: true, command: { kind: "setMode", mode: "ban" } });
  });

  it("rejects blocklistmode with an invalid mode", () => {
    const result = parseBlocklistCommand(
      baseUpdate({ command: cmd("blocklistmode", ["explode"]) }),
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid-mode" },
    });
    if (result && !result.ok) {
      expect(result.error.usage).toContain("/blocklistmode");
    }
  });

  it("rejects blocklistmode without a mode", () => {
    expect(
      parseBlocklistCommand(baseUpdate({ command: cmd("blocklistmode", []) })),
    ).toMatchObject({ ok: false, error: { code: "invalid-mode" } });
  });
});

describe("normalizeBlocklistTrigger", () => {
  it("lowercases and trims", () => {
    expect(normalizeBlocklistTrigger("  SPAM  ")).toBe("spam");
  });

  it("collapses multiple internal spaces to one", () => {
    expect(normalizeBlocklistTrigger("Vende    SEGUIDORES")).toBe(
      "vende seguidores",
    );
  });

  it("collapses tabs and newlines as whitespace", () => {
    expect(normalizeBlocklistTrigger("vende\t\nseguidores")).toBe(
      "vende seguidores",
    );
  });
});

describe("matchBlocklist", () => {
  const entries: readonly BlocklistEntry[] = [
    { trigger: "spam", reason: undefined },
    { trigger: "vende seguidores", reason: "publicidad" },
    { trigger: "gana * dinero", reason: undefined },
  ];

  it("matches an exact normalized trigger", () => {
    expect(matchBlocklist("spam", entries)).toEqual({
      trigger: "spam",
      reason: undefined,
    });
  });

  it("matches a trigger as a substring of the text", () => {
    expect(matchBlocklist("esto es puro spam total", entries)).toEqual({
      trigger: "spam",
      reason: undefined,
    });
  });

  it("matches case-insensitively", () => {
    expect(matchBlocklist("VENDE SEGUIDORES baratos", entries)).toEqual({
      trigger: "vende seguidores",
      reason: "publicidad",
    });
  });

  it("matches a trigger with an internal wildcard", () => {
    expect(matchBlocklist("aqui gana mucho dinero ya", entries)).toEqual({
      trigger: "gana * dinero",
      reason: undefined,
    });
  });

  it("matches a wildcard spanning an empty sequence", () => {
    const wildcardOnly: readonly BlocklistEntry[] = [
      { trigger: "gana*dinero", reason: undefined },
    ];
    expect(matchBlocklist("ganadinero rapido", wildcardOnly)).toEqual({
      trigger: "gana*dinero",
      reason: undefined,
    });
  });

  it("returns null when nothing matches", () => {
    expect(matchBlocklist("mensaje totalmente limpio", entries)).toBeNull();
  });

  it("returns null for empty text", () => {
    expect(matchBlocklist("", entries)).toBeNull();
  });

  it("returns null for an empty entry list", () => {
    expect(matchBlocklist("spam", [])).toBeNull();
  });

  it("returns the first matching entry when several match", () => {
    const multi: readonly BlocklistEntry[] = [
      { trigger: "hola", reason: "primero" },
      { trigger: "mundo", reason: "segundo" },
    ];
    expect(matchBlocklist("hola mundo", multi)).toEqual({
      trigger: "hola",
      reason: "primero",
    });
  });

  it("treats regex metacharacters in the trigger literally", () => {
    const literal: readonly BlocklistEntry[] = [
      { trigger: "a.b", reason: undefined },
    ];
    expect(matchBlocklist("axb", literal)).toBeNull();
    expect(matchBlocklist("a.b aqui", literal)).toEqual({
      trigger: "a.b",
      reason: undefined,
    });
  });

  it("matches multiple wildcards in order and rejects out-of-order text", () => {
    const multiStar: readonly BlocklistEntry[] = [
      { trigger: "vende*seguidores*baratos", reason: "spam" },
    ];
    expect(
      matchBlocklist("hoy vende muchos seguidores super baratos ya", multiStar),
    ).toEqual({ trigger: "vende*seguidores*baratos", reason: "spam" });
    // Same words, wrong order → no match (segments must appear in sequence).
    expect(
      matchBlocklist("baratos seguidores vende", multiStar),
    ).toBeNull();
  });

  it("does not catastrophically backtrack on a wildcard-heavy trigger (ReDoS guard)", () => {
    // 20 `*` wildcards + a trailing literal that never appears in the text.
    // Before the fix this compiled to 20 chained `[\\s\\S]*` and, against a long
    // almost-matching string, hung for far longer than any test timeout (the
    // audit measured >30s at just 15 wildcards). The linear scan returns in
    // microseconds, so the tight per-test timeout below only passes post-fix.
    const evil: readonly BlocklistEntry[] = [
      { trigger: `${"a*".repeat(20)}b`, reason: undefined },
    ];
    const hostile = "a".repeat(80);
    expect(matchBlocklist(hostile, evil)).toBeNull();
  }, 2000);
});
