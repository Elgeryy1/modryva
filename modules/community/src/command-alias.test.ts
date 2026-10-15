import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  isValidAliasToken,
  normalizeAlias,
  parseAliasCommand,
  resolveCommandAlias,
} from "./command-alias.js";

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

describe("normalizeAlias", () => {
  it("lowercases and trims", () => {
    expect(normalizeAlias("  Reglas  ")).toBe("reglas");
  });

  it("strips leading slashes", () => {
    expect(normalizeAlias("/rules")).toBe("rules");
    expect(normalizeAlias("//Rules")).toBe("rules");
  });

  it("leaves an already normalized token unchanged", () => {
    expect(normalizeAlias("rules")).toBe("rules");
  });

  it("is idempotent", () => {
    const once = normalizeAlias("  /Foo_BAR ");
    expect(normalizeAlias(once)).toBe(once);
  });
});

describe("isValidAliasToken", () => {
  it("accepts valid identifiers", () => {
    expect(isValidAliasToken("rules")).toBe(true);
    expect(isValidAliasToken("/Reglas_2")).toBe(true);
  });

  it("rejects empty and out-of-range length", () => {
    expect(isValidAliasToken("")).toBe(false);
    expect(isValidAliasToken("   ")).toBe(false);
    expect(isValidAliasToken("a".repeat(33))).toBe(false);
  });

  it("rejects disallowed characters", () => {
    expect(isValidAliasToken("reglas!")).toBe(false);
    expect(isValidAliasToken("con espacio")).toBe(false);
    expect(isValidAliasToken("acentúa")).toBe(false);
  });
});

describe("resolveCommandAlias", () => {
  const aliases: Readonly<Record<string, string>> = {
    reglas: "rules",
    normas: "rules",
    silencio: "mute",
  };

  it("resolves a known alias to its canonical command", () => {
    expect(resolveCommandAlias("reglas", aliases)).toBe("rules");
    expect(resolveCommandAlias("silencio", aliases)).toBe("mute");
  });

  it("normalizes the input before lookup", () => {
    expect(resolveCommandAlias("  /Reglas ", aliases)).toBe("rules");
    expect(resolveCommandAlias("NORMAS", aliases)).toBe("rules");
  });

  it("returns the normalized input when it is not an alias", () => {
    expect(resolveCommandAlias("/Ban", aliases)).toBe("ban");
    expect(resolveCommandAlias("kick", aliases)).toBe("kick");
  });

  it("returns normalized input for an empty alias map", () => {
    expect(resolveCommandAlias("Rules", {})).toBe("rules");
  });

  it("is deterministic for identical inputs", () => {
    expect(resolveCommandAlias("reglas", aliases)).toBe(
      resolveCommandAlias("reglas", aliases),
    );
  });
});

describe("parseAliasCommand", () => {
  it("returns null for other commands or no command", () => {
    expect(parseAliasCommand(baseUpdate({ command: cmd("ban") }))).toBeNull();
    expect(parseAliasCommand(baseUpdate())).toBeNull();
  });

  it("parses /alias list", () => {
    expect(
      parseAliasCommand(baseUpdate({ command: cmd("alias", ["list"]) })),
    ).toEqual({ ok: true, command: { kind: "list" } });
  });

  it("parses /alias set normalizing both tokens", () => {
    expect(
      parseAliasCommand(
        baseUpdate({ command: cmd("alias", ["set", "/Reglas", "RULES"]) }),
      ),
    ).toEqual({
      ok: true,
      command: { kind: "set", alias: "reglas", command: "rules" },
    });
  });

  it("accepts add as an alias of set", () => {
    expect(
      parseAliasCommand(
        baseUpdate({ command: cmd("alias", ["add", "s", "stats"]) }),
      ),
    ).toEqual({
      ok: true,
      command: { kind: "set", alias: "s", command: "stats" },
    });
  });

  it("parses /alias remove normalizing the alias", () => {
    expect(
      parseAliasCommand(
        baseUpdate({ command: cmd("alias", ["remove", "Reglas"]) }),
      ),
    ).toEqual({ ok: true, command: { kind: "remove", alias: "reglas" } });
  });

  it("accepts del and delete as aliases of remove", () => {
    expect(
      parseAliasCommand(baseUpdate({ command: cmd("alias", ["del", "s"]) })),
    ).toEqual({ ok: true, command: { kind: "remove", alias: "s" } });
    expect(
      parseAliasCommand(baseUpdate({ command: cmd("alias", ["delete", "s"]) })),
    ).toEqual({ ok: true, command: { kind: "remove", alias: "s" } });
  });

  it("errors with usage when there is no action", () => {
    const result = parseAliasCommand(baseUpdate({ command: cmd("alias") }));
    expect(result).toEqual({
      ok: false,
      error: {
        code: "usage",
        message:
          "Uso: /alias set <alias> <comando> | /alias remove <alias> | /alias list",
      },
    });
  });

  it("errors with usage for an unknown action", () => {
    const result = parseAliasCommand(
      baseUpdate({ command: cmd("alias", ["frobnicate"]) }),
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: "usage",
        message:
          "Uso: /alias set <alias> <comando> | /alias remove <alias> | /alias list",
      },
    });
  });

  it("errors with usage when set lacks the command token", () => {
    const result = parseAliasCommand(
      baseUpdate({ command: cmd("alias", ["set", "reglas"]) }),
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: "usage",
        message:
          "Uso: /alias set <alias> <comando> | /alias remove <alias> | /alias list",
      },
    });
  });

  it("errors with usage when remove lacks the alias token", () => {
    const result = parseAliasCommand(
      baseUpdate({ command: cmd("alias", ["remove"]) }),
    );
    expect(result?.ok).toBe(false);
    if (result && !result.ok) {
      expect(result.error.code).toBe("usage");
    }
  });

  it("rejects an invalid alias token on set", () => {
    const result = parseAliasCommand(
      baseUpdate({ command: cmd("alias", ["set", "con!", "rules"]) }),
    );
    expect(result?.ok).toBe(false);
    if (result && !result.ok) {
      expect(result.error.code).toBe("invalid-alias");
    }
  });

  it("rejects an invalid command token on set", () => {
    const result = parseAliasCommand(
      baseUpdate({ command: cmd("alias", ["set", "reglas", "ru les"]) }),
    );
    expect(result?.ok).toBe(false);
    if (result && !result.ok) {
      expect(result.error.code).toBe("invalid-command");
    }
  });

  it("rejects using the reserved word 'alias' as an alias", () => {
    const result = parseAliasCommand(
      baseUpdate({ command: cmd("alias", ["set", "alias", "rules"]) }),
    );
    expect(result?.ok).toBe(false);
    if (result && !result.ok) {
      expect(result.error.code).toBe("reserved-alias");
    }
  });

  it("rejects an invalid alias token on remove", () => {
    const result = parseAliasCommand(
      baseUpdate({ command: cmd("alias", ["remove", "bad name"]) }),
    );
    expect(result?.ok).toBe(false);
    if (result && !result.ok) {
      expect(result.error.code).toBe("invalid-alias");
    }
  });

  it("is deterministic for identical set inputs", () => {
    const update = baseUpdate({
      command: cmd("alias", ["set", "reglas", "rules"]),
    });
    expect(parseAliasCommand(update)).toEqual(parseAliasCommand(update));
  });
});
