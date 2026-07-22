import type {
  NormalizedCommand,
  TelegramUpdateEnvelope,
} from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  evaluateExpression,
  formatCalcResult,
  fromBase64,
  generatePassword,
  parseUtilityCommand,
  pickOption,
  sha256Hex,
  toBase64,
} from "./utilities.js";

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
): NormalizedCommand => ({
  name,
  raw: args.length > 0 ? `/${name} ${args.join(" ")}` : `/${name}`,
  args,
});

describe("evaluateExpression", () => {
  it("applies multiplication before addition", () => {
    expect(evaluateExpression("2+3*4")).toEqual({ ok: true, value: 14 });
  });

  it("treats power as right-associative", () => {
    expect(evaluateExpression("2^3^2")).toEqual({ ok: true, value: 512 });
  });

  it("respects parentheses", () => {
    expect(evaluateExpression("(2+3)*4")).toEqual({ ok: true, value: 20 });
  });

  it("handles unary minus", () => {
    expect(evaluateExpression("-3+5")).toEqual({ ok: true, value: 2 });
    expect(evaluateExpression("2*-3")).toEqual({ ok: true, value: -6 });
  });

  it("supports modulo and decimals with spaces", () => {
    expect(evaluateExpression("10 % 3")).toEqual({ ok: true, value: 1 });
    expect(evaluateExpression(" 1.5 * 2 ")).toEqual({ ok: true, value: 3 });
  });

  it("reports division and modulo by zero", () => {
    expect(evaluateExpression("5/0")).toEqual({
      ok: false,
      reason: "division-by-zero",
    });
    expect(evaluateExpression("7%0")).toEqual({
      ok: false,
      reason: "division-by-zero",
    });
  });

  it("reports syntax errors for malformed expressions", () => {
    expect(evaluateExpression("2++")).toEqual({ ok: false, reason: "syntax" });
    expect(evaluateExpression("abc")).toEqual({ ok: false, reason: "syntax" });
    expect(evaluateExpression("")).toEqual({ ok: false, reason: "syntax" });
    expect(evaluateExpression("(2+3")).toEqual({ ok: false, reason: "syntax" });
    expect(evaluateExpression("2 3")).toEqual({ ok: false, reason: "syntax" });
  });
});

describe("formatCalcResult", () => {
  it("cleans floating point noise like 0.1+0.2", () => {
    const result = evaluateExpression("0.1+0.2");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(formatCalcResult(result.value)).toBe("0.3");
    }
  });

  it("renders integers without a decimal point", () => {
    expect(formatCalcResult(4)).toBe("4");
    expect(formatCalcResult(-120)).toBe("-120");
  });

  it("keeps exact decimals and drops trailing zeros", () => {
    expect(formatCalcResult(2.5)).toBe("2.5");
    expect(formatCalcResult(-0.30000000000000004)).toBe("-0.3");
  });
});

describe("toBase64 y fromBase64", () => {
  it("encodes utf8 text as base64", () => {
    expect(toBase64("hola")).toBe("aG9sYQ==");
  });

  it("roundtrips arbitrary text", () => {
    for (const text of ["Hola mundo 123!", "", "linea con | y ,"]) {
      expect(fromBase64(toBase64(text))).toEqual({ ok: true, text });
    }
  });

  it("rejects strings that are not real base64", () => {
    expect(fromBase64("no base64!!!")).toEqual({ ok: false });
    expect(fromBase64("aGVsbG8")).toEqual({ ok: false });
    expect(fromBase64("aaa=a===")).toEqual({ ok: false });
  });
});

describe("sha256Hex", () => {
  it("matches the known sha256 of 'hola'", () => {
    expect(sha256Hex("hola")).toBe(
      "b221d9dbb083a7f33428d7c2a3c3198ae925614d70210e28716ccaa7cd4ddb79",
    );
  });

  it("is deterministic and differs for different inputs", () => {
    expect(sha256Hex("abc")).toBe(sha256Hex("abc"));
    expect(sha256Hex("abc")).not.toBe(sha256Hex("abd"));
  });
});

describe("pickOption", () => {
  it("is deterministic for the same seed", () => {
    const options = ["rojo", "verde", "azul"];
    expect(pickOption(options, 42)).toBe(pickOption(options, 42));
  });

  it("always returns a member of the list", () => {
    const options = ["a", "b", "c", "d"];
    for (let seed = 0; seed <= 20; seed += 1) {
      const picked = pickOption(options, seed);
      expect(picked).toBeDefined();
      expect(options).toContain(picked);
    }
  });

  it("returns undefined for an empty list", () => {
    expect(pickOption([], 7)).toBeUndefined();
  });
});

describe("generatePassword", () => {
  it("respects the requested length and clamps to 8..64", () => {
    expect(generatePassword(16, 1)).toHaveLength(16);
    expect(generatePassword(4, 1)).toHaveLength(8);
    expect(generatePassword(200, 1)).toHaveLength(64);
  });

  it("is deterministic per seed and varies across seeds", () => {
    expect(generatePassword(16, 42)).toBe(generatePassword(16, 42));
    expect(generatePassword(16, 42)).not.toBe(generatePassword(16, 43));
  });

  it("contains all four character classes", () => {
    for (const seed of [0, 1, 99, 12345]) {
      const password = generatePassword(12, seed);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[2-9]/);
      expect(password).toMatch(/[!@#$%&*+\-_?]/);
    }
  });

  it("never uses ambiguous characters", () => {
    for (const seed of [0, 7, 500, 90210]) {
      expect(generatePassword(64, seed)).not.toMatch(/[0O1lI]/);
    }
  });
});

describe("parseUtilityCommand", () => {
  it("returns null for non-utility commands and updates without command", () => {
    expect(parseUtilityCommand(baseUpdate({ command: cmd("ban") }))).toBeNull();
    expect(parseUtilityCommand(baseUpdate())).toBeNull();
  });

  it("parses /calc and rejects an empty expression", () => {
    expect(
      parseUtilityCommand(
        baseUpdate({ command: cmd("calc", ["2", "+", "2"]) }),
      ),
    ).toEqual({ ok: true, command: { kind: "calc", expression: "2 + 2" } });
    expect(parseUtilityCommand(baseUpdate({ command: cmd("calc") }))).toEqual({
      ok: false,
      error: { code: "format", usage: "Uso: /calc <expresion>" },
    });
  });

  it("parses /id without arguments", () => {
    expect(parseUtilityCommand(baseUpdate({ command: cmd("id") }))).toEqual({
      ok: true,
      command: { kind: "id" },
    });
  });

  it("parses /pick separated by pipes", () => {
    expect(
      parseUtilityCommand(
        baseUpdate({ command: cmd("pick", ["uno", "|", "dos", "|", "tres"]) }),
      ),
    ).toEqual({
      ok: true,
      command: { kind: "pick", options: ["uno", "dos", "tres"] },
    });
  });

  it("parses /pick separated by commas when there is no pipe", () => {
    expect(
      parseUtilityCommand(
        baseUpdate({ command: cmd("pick", ["rojo,", "verde,", "azul"]) }),
      ),
    ).toEqual({
      ok: true,
      command: { kind: "pick", options: ["rojo", "verde", "azul"] },
    });
  });

  it("rejects /pick with fewer than 2 options", () => {
    expect(
      parseUtilityCommand(baseUpdate({ command: cmd("pick", ["solo"]) })),
    ).toEqual({
      ok: false,
      error: { code: "format", usage: "Uso: /pick opcion1 | opcion2 [| ...]" },
    });
    expect(
      parseUtilityCommand(baseUpdate({ command: cmd("pick") })),
    ).toMatchObject({ ok: false, error: { code: "format" } });
  });

  it("parses the text commands with the joined arguments", () => {
    const cases = [
      ["b64", "b64"],
      ["unb64", "unb64"],
      ["hash", "hash"],
      ["reverse", "reverse"],
      ["len", "len"],
      ["upper", "upper"],
      ["lower", "lower"],
    ] as const;

    for (const [name, kind] of cases) {
      expect(
        parseUtilityCommand(
          baseUpdate({ command: cmd(name, ["hola", "mundo"]) }),
        ),
      ).toEqual({ ok: true, command: { kind, text: "hola mundo" } });
    }
  });

  it("rejects text commands without text", () => {
    expect(parseUtilityCommand(baseUpdate({ command: cmd("hash") }))).toEqual({
      ok: false,
      error: { code: "format", usage: "Uso: /hash <texto>" },
    });
    expect(
      parseUtilityCommand(baseUpdate({ command: cmd("reverse", ["  "]) })),
    ).toMatchObject({ ok: false, error: { code: "format" } });
  });

  it("parses /password with default and explicit lengths", () => {
    expect(
      parseUtilityCommand(baseUpdate({ command: cmd("password") })),
    ).toEqual({ ok: true, command: { kind: "password", length: 16 } });
    expect(
      parseUtilityCommand(baseUpdate({ command: cmd("password", ["20"]) })),
    ).toEqual({ ok: true, command: { kind: "password", length: 20 } });
  });

  it("clamps /password lengths into 8..64", () => {
    expect(
      parseUtilityCommand(baseUpdate({ command: cmd("password", ["4"]) })),
    ).toEqual({ ok: true, command: { kind: "password", length: 8 } });
    expect(
      parseUtilityCommand(baseUpdate({ command: cmd("password", ["999"]) })),
    ).toEqual({ ok: true, command: { kind: "password", length: 64 } });
  });

  it("rejects /password with a non-numeric length", () => {
    expect(
      parseUtilityCommand(baseUpdate({ command: cmd("password", ["abc"]) })),
    ).toEqual({
      ok: false,
      error: { code: "format", usage: "Uso: /password [longitud]" },
    });
  });
});
