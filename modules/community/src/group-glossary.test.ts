import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  type GlossaryMatch,
  lookupGlossary,
  normalizeGlossaryTerm,
  parseGlossaryCommand,
} from "./group-glossary.js";

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

const terms = (matches: readonly GlossaryMatch[]): readonly string[] =>
  matches.map((m) => m.term);

describe("normalizeGlossaryTerm", () => {
  it("lowercases, trims and collapses inner whitespace", () => {
    expect(normalizeGlossaryTerm("  In   Joke  ")).toBe("in joke");
  });

  it("strips diacritics", () => {
    expect(normalizeGlossaryTerm("Ñoño Café")).toBe("nono cafe");
  });

  it("returns empty for whitespace-only input", () => {
    expect(normalizeGlossaryTerm("   ")).toBe("");
  });
});

describe("lookupGlossary", () => {
  const glossary: Readonly<Record<string, string>> = {
    gg: "good game",
    lol: "risa",
    afk: "lejos del teclado",
  };

  it("returns matched terms in order of appearance", () => {
    const result = lookupGlossary("primero lol y luego gg", glossary);
    expect(terms(result)).toEqual(["lol", "gg"]);
  });

  it("preserves the original glossary key and meaning", () => {
    expect(lookupGlossary("dijo gg", glossary)).toEqual([
      { term: "gg", meaning: "good game" },
    ]);
  });

  it("matches ignoring case and accents", () => {
    const g: Readonly<Record<string, string>> = { cafe: "bebida" };
    expect(terms(lookupGlossary("un CAFÉ caliente", g))).toEqual(["cafe"]);
  });

  it("does not duplicate a term mentioned twice", () => {
    expect(terms(lookupGlossary("gg gg gg wp", glossary))).toEqual(["gg"]);
  });

  it("only matches whole words, not substrings", () => {
    expect(lookupGlossary("eggs and toggle", glossary)).toEqual([]);
  });

  it("matches a term adjacent to punctuation", () => {
    expect(terms(lookupGlossary("hola, gg! bien jugado", glossary))).toEqual([
      "gg",
    ]);
  });

  it("returns empty for text without glossary terms", () => {
    expect(lookupGlossary("nada relevante aqui", glossary)).toEqual([]);
  });

  it("returns empty for empty or whitespace-only text", () => {
    expect(lookupGlossary("", glossary)).toEqual([]);
    expect(lookupGlossary("   ", glossary)).toEqual([]);
  });

  it("returns empty for an empty glossary", () => {
    expect(lookupGlossary("gg lol afk", {})).toEqual([]);
  });

  it("matches multi-word glossary terms", () => {
    const g: Readonly<Record<string, string>> = { "in joke": "broma interna" };
    expect(terms(lookupGlossary("eso es un In Joke clasico", g))).toEqual([
      "in joke",
    ]);
  });

  it("ignores glossary keys that normalize to empty", () => {
    const g: Readonly<Record<string, string>> = { "   ": "vacio", gg: "gigi" };
    expect(terms(lookupGlossary("gg", g))).toEqual(["gg"]);
  });

  it("is deterministic across repeated calls", () => {
    const a = lookupGlossary("lol gg afk", glossary);
    const b = lookupGlossary("lol gg afk", glossary);
    expect(a).toEqual(b);
  });
});

describe("parseGlossaryCommand", () => {
  it("returns null when the command is not /glosario", () => {
    expect(
      parseGlossaryCommand(baseUpdate({ command: cmd("ban") })),
    ).toBeNull();
    expect(parseGlossaryCommand(baseUpdate())).toBeNull();
  });

  it("parses list", () => {
    expect(
      parseGlossaryCommand(baseUpdate({ command: cmd("glosario", ["list"]) })),
    ).toEqual({ ok: true, command: { kind: "list" } });
  });

  it("parses set with a normalized term and joined meaning", () => {
    expect(
      parseGlossaryCommand(
        baseUpdate({
          command: cmd("glosario", ["set", "GG", "good", "game"]),
        }),
      ),
    ).toEqual({
      ok: true,
      command: { kind: "set", term: "gg", meaning: "good game" },
    });
  });

  it("parses remove with a normalized term", () => {
    expect(
      parseGlossaryCommand(
        baseUpdate({ command: cmd("glosario", ["remove", "AFK"]) }),
      ),
    ).toEqual({ ok: true, command: { kind: "remove", term: "afk" } });
  });

  it("errors on set without a meaning", () => {
    expect(
      parseGlossaryCommand(
        baseUpdate({ command: cmd("glosario", ["set", "gg"]) }),
      ),
    ).toEqual({
      ok: false,
      error: {
        code: "missing-meaning",
        usage: "Uso: /glosario set <término> <significado>",
      },
    });
  });

  it("errors on set without a term", () => {
    expect(
      parseGlossaryCommand(baseUpdate({ command: cmd("glosario", ["set"]) })),
    ).toEqual({
      ok: false,
      error: {
        code: "missing-term",
        usage: "Uso: /glosario set <término> <significado>",
      },
    });
  });

  it("errors on remove without a term", () => {
    expect(
      parseGlossaryCommand(
        baseUpdate({ command: cmd("glosario", ["remove"]) }),
      ),
    ).toEqual({
      ok: false,
      error: {
        code: "missing-term",
        usage: "Uso: /glosario remove <término>",
      },
    });
  });

  it("errors on an unknown subcommand", () => {
    expect(
      parseGlossaryCommand(
        baseUpdate({ command: cmd("glosario", ["frobnicate"]) }),
      ),
    ).toEqual({
      ok: false,
      error: {
        code: "invalid-subcommand",
        usage: "Uso: /glosario set|remove|list",
      },
    });
  });

  it("errors on /glosario with no subcommand", () => {
    expect(
      parseGlossaryCommand(baseUpdate({ command: cmd("glosario") })),
    ).toEqual({
      ok: false,
      error: {
        code: "invalid-subcommand",
        usage: "Uso: /glosario set|remove|list",
      },
    });
  });

  it("accepts subcommands case-insensitively", () => {
    expect(
      parseGlossaryCommand(baseUpdate({ command: cmd("glosario", ["LIST"]) })),
    ).toEqual({ ok: true, command: { kind: "list" } });
  });

  it("treats a whitespace-only term token as missing", () => {
    expect(
      parseGlossaryCommand(
        baseUpdate({ command: cmd("glosario", ["set", "   ", "algo"]) }),
      ),
    ).toEqual({
      ok: false,
      error: {
        code: "missing-term",
        usage: "Uso: /glosario set <término> <significado>",
      },
    });
  });
});
