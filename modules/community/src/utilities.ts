import { createHash } from "node:crypto";
import type { TelegramUpdateEnvelope } from "@superbot/domain";

export type UtilityCommand =
  | { kind: "calc"; expression: string }
  | { kind: "id" }
  | { kind: "pick"; options: readonly string[] }
  | { kind: "b64"; text: string }
  | { kind: "unb64"; text: string }
  | { kind: "hash"; text: string }
  | { kind: "reverse"; text: string }
  | { kind: "len"; text: string }
  | { kind: "upper"; text: string }
  | { kind: "lower"; text: string }
  | { kind: "password"; length: number };

export interface UtilityCommandError {
  readonly code: "format";
  readonly usage: string;
}

export type UtilityCommandResult =
  | { readonly ok: true; readonly command: UtilityCommand }
  | { readonly ok: false; readonly error: UtilityCommandError };

const usages = {
  calc: "Uso: /calc <expresion>",
  pick: "Uso: /pick opcion1 | opcion2 [| ...]",
  b64: "Uso: /b64 <texto>",
  unb64: "Uso: /unb64 <texto>",
  hash: "Uso: /hash <texto>",
  reverse: "Uso: /reverse <texto>",
  len: "Uso: /len <texto>",
  upper: "Uso: /upper <texto>",
  lower: "Uso: /lower <texto>",
  password: "Uso: /password [longitud]",
} as const;

const ok = (command: UtilityCommand): UtilityCommandResult => ({
  ok: true,
  command,
});

const formatError = (usage: string): UtilityCommandResult => ({
  ok: false,
  error: { code: "format", usage },
});

const textKinds = [
  "b64",
  "unb64",
  "hash",
  "reverse",
  "len",
  "upper",
  "lower",
] as const;

type TextKind = (typeof textKinds)[number];

const isTextKind = (name: string): name is TextKind =>
  (textKinds as readonly string[]).includes(name);

const passwordDefaultLength = 16;
const passwordMinLength = 8;
const passwordMaxLength = 64;

/**
 * Parses the utility commands `/calc`, `/id`, `/pick`, `/b64`, `/unb64`,
 * `/hash`, `/reverse`, `/len`, `/upper`, `/lower` and `/password`.
 *
 * Returns null when the update does not carry one of those commands. Returns
 * a format error with a Spanish usage string when the arguments are invalid:
 * empty text for text commands, fewer than 2 options for `/pick`, or a
 * non-numeric length for `/password`. Pure and deterministic: the result
 * depends only on the envelope.
 */
export const parseUtilityCommand = (
  update: TelegramUpdateEnvelope,
): UtilityCommandResult | null => {
  const name = update.command?.name;

  if (name === undefined) {
    return null;
  }

  const args = update.command?.args ?? [];
  const text = args.join(" ").trim();

  if (name === "calc") {
    return text.length === 0
      ? formatError(usages.calc)
      : ok({ kind: "calc", expression: text });
  }

  if (name === "id") {
    return ok({ kind: "id" });
  }

  if (name === "pick") {
    const separator = text.includes("|") ? "|" : ",";
    const options = text
      .split(separator)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    return options.length < 2
      ? formatError(usages.pick)
      : ok({ kind: "pick", options });
  }

  if (isTextKind(name)) {
    return text.length === 0
      ? formatError(usages[name])
      : ok({ kind: name, text });
  }

  if (name === "password") {
    const rawLength = args[0];

    if (rawLength === undefined) {
      return ok({ kind: "password", length: passwordDefaultLength });
    }

    if (!/^\d+$/.test(rawLength)) {
      return formatError(usages.password);
    }

    const parsed = Number.parseInt(rawLength, 10);
    const length = Math.min(
      passwordMaxLength,
      Math.max(passwordMinLength, parsed),
    );

    return ok({ kind: "password", length });
  }

  return null;
};

type CalcFailureReason = "syntax" | "division-by-zero";

class CalcError extends Error {
  readonly reason: CalcFailureReason;

  constructor(reason: CalcFailureReason) {
    super(`calc: ${reason}`);
    this.reason = reason;
  }
}

type CalcToken =
  | { type: "number"; value: number }
  | { type: "op"; value: string };

const operatorChars = "+-*/%^()";

const tokenizeExpression = (expression: string): CalcToken[] | null => {
  const tokens: CalcToken[] = [];
  let index = 0;

  while (index < expression.length) {
    const char = expression[index] ?? "";

    if (char === " " || char === "\t") {
      index += 1;
      continue;
    }

    if (operatorChars.includes(char)) {
      tokens.push({ type: "op", value: char });
      index += 1;
      continue;
    }

    if ((char >= "0" && char <= "9") || char === ".") {
      let cursor = index;
      let hasDigit = false;
      let hasDot = false;

      while (cursor < expression.length) {
        const current = expression[cursor] ?? "";

        if (current >= "0" && current <= "9") {
          hasDigit = true;
          cursor += 1;
        } else if (current === "." && !hasDot) {
          hasDot = true;
          cursor += 1;
        } else {
          break;
        }
      }

      if (!hasDigit) {
        return null;
      }

      tokens.push({
        type: "number",
        value: Number.parseFloat(expression.slice(index, cursor)),
      });
      index = cursor;
      continue;
    }

    return null;
  }

  return tokens;
};

/**
 * Evaluates an arithmetic expression with a hand-written recursive descent
 * parser (no eval/Function). Supports decimal numbers, `+ - * / % ^`
 * (right-associative power), parentheses, unary minus and whitespace.
 * Division or modulo by zero yields `division-by-zero`; any invalid token or
 * malformed expression yields `syntax`. Pure and deterministic.
 */
export const evaluateExpression = (
  expression: string,
): { ok: true; value: number } | { ok: false; reason: CalcFailureReason } => {
  const tokens = tokenizeExpression(expression);

  if (tokens === null || tokens.length === 0) {
    return { ok: false, reason: "syntax" };
  }

  let position = 0;

  const matchOp = (value: string): boolean => {
    const token = tokens[position];

    if (token?.type === "op" && token.value === value) {
      position += 1;
      return true;
    }

    return false;
  };

  const parseExpr = (): number => {
    let left = parseTerm();

    for (;;) {
      if (matchOp("+")) {
        left += parseTerm();
      } else if (matchOp("-")) {
        left -= parseTerm();
      } else {
        return left;
      }
    }
  };

  const parseTerm = (): number => {
    let left = parseUnary();

    for (;;) {
      if (matchOp("*")) {
        left *= parseUnary();
      } else if (matchOp("/")) {
        const right = parseUnary();

        if (right === 0) {
          throw new CalcError("division-by-zero");
        }

        left /= right;
      } else if (matchOp("%")) {
        const right = parseUnary();

        if (right === 0) {
          throw new CalcError("division-by-zero");
        }

        left %= right;
      } else {
        return left;
      }
    }
  };

  const parseUnary = (): number =>
    matchOp("-") ? -parseUnary() : parsePower();

  const parsePower = (): number => {
    const base = parsePrimary();

    return matchOp("^") ? base ** parseUnary() : base;
  };

  const parsePrimary = (): number => {
    const token = tokens[position];

    if (token === undefined) {
      throw new CalcError("syntax");
    }

    if (token.type === "number") {
      position += 1;
      return token.value;
    }

    if (token.value === "(") {
      position += 1;
      const value = parseExpr();

      if (!matchOp(")")) {
        throw new CalcError("syntax");
      }

      return value;
    }

    throw new CalcError("syntax");
  };

  try {
    const value = parseExpr();

    if (position !== tokens.length) {
      return { ok: false, reason: "syntax" };
    }

    return { ok: true, value };
  } catch (error) {
    if (error instanceof CalcError) {
      return { ok: false, reason: error.reason };
    }

    throw error;
  }
};

/**
 * Formats a calc result: rounds to 10 significant decimal digits, drops
 * trailing zeros and renders integers without a decimal point. Pure.
 */
export const formatCalcResult = (value: number): string => {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return String(Number.parseFloat(value.toPrecision(10)));
};

/**
 * Encodes UTF-8 text as base64. Pure and deterministic.
 */
export const toBase64 = (text: string): string =>
  Buffer.from(text, "utf8").toString("base64");

/**
 * Decodes base64 into UTF-8 text. Validates that the input is real base64 by
 * checking the alphabet, the padding length and that re-encoding the decoded
 * bytes reproduces the input exactly (roundtrip). Pure and deterministic.
 */
export const fromBase64 = (
  text: string,
): { ok: true; text: string } | { ok: false } => {
  if (text.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) {
    return { ok: false };
  }

  const decoded = Buffer.from(text, "base64");

  if (decoded.toString("base64") !== text) {
    return { ok: false };
  }

  return { ok: true, text: decoded.toString("utf8") };
};

/**
 * Returns the SHA-256 hash of the UTF-8 text as lowercase hex. Deterministic:
 * node:crypto hashing has no randomness or clock dependency.
 */
export const sha256Hex = (text: string): string =>
  createHash("sha256").update(text, "utf8").digest("hex");

const lcgNext = (state: number): number =>
  (Math.imul(state, 1664525) + 1013904223) >>> 0;

const normalizeSeed = (seed: number): number =>
  Math.trunc(Math.abs(seed)) >>> 0;

/**
 * Picks one option deterministically from `seed` using one LCG step over the
 * normalized seed. Returns undefined when the list is empty. Identical inputs
 * always yield the same option.
 */
export const pickOption = (
  options: readonly string[],
  seed: number,
): string | undefined => {
  if (options.length === 0) {
    return undefined;
  }

  return options[lcgNext(normalizeSeed(seed)) % options.length];
};

const passwordLower = "abcdefghijkmnopqrstuvwxyz";
const passwordUpper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const passwordDigits = "23456789";
const passwordSymbols = "!@#$%&*+-_?";

/**
 * Generates a deterministic password from `seed` using an LCG. The length is
 * clamped to 8..64. Guarantees at least one lowercase, one uppercase, one
 * digit and one symbol from "!@#$%&*+-_?", and never uses the ambiguous
 * characters 0/O/1/l/I. Identical inputs always yield the same password.
 */
export const generatePassword = (length: number, seed: number): string => {
  const truncated = Math.trunc(length);
  const clamped = Math.min(
    passwordMaxLength,
    Math.max(passwordMinLength, Number.isFinite(truncated) ? truncated : 0),
  );

  let state = lcgNext(normalizeSeed(seed) ^ 0x9e3779b9);

  const next = (): number => {
    state = lcgNext(state);
    return state;
  };

  const pools = [passwordLower, passwordUpper, passwordDigits, passwordSymbols];
  const allChars = pools.join("");
  const chars: string[] = [];

  for (let index = 0; index < clamped; index += 1) {
    const pool = index < pools.length ? (pools[index] ?? allChars) : allChars;
    chars.push(pool[next() % pool.length] ?? "a");
  }

  for (let index = chars.length - 1; index > 0; index -= 1) {
    const target = next() % (index + 1);
    const current = chars[index] ?? "";
    chars[index] = chars[target] ?? "";
    chars[target] = current;
  }

  return chars.join("");
};
