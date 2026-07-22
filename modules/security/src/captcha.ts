import { createHash } from "node:crypto";
import type { TelegramUpdateEnvelope } from "@superbot/domain";

export type CaptchaMode = "button" | "math" | "text";

const captchaModes: ReadonlySet<string> = new Set(["button", "math", "text"]);

export interface CaptchaSettings {
  readonly enabled: boolean;
  readonly mode: CaptchaMode;
  readonly timeoutSeconds: number;
  readonly maxAttempts: number;
  readonly failAction: "ban" | "mute" | "restrict";
}

export const defaultCaptchaSettings: CaptchaSettings = {
  enabled: false,
  mode: "button",
  timeoutSeconds: 120,
  maxAttempts: 3,
  failAction: "ban",
};

export interface CaptchaButton {
  readonly label: string;
  readonly token: string;
  readonly correct: boolean;
}

export interface CaptchaChallenge {
  readonly mode: CaptchaMode;
  readonly prompt: string;
  /** Normalized expected answer (lowercased, trimmed). Never sent to the user. */
  readonly answer: string;
  readonly buttons: readonly CaptchaButton[];
}

/**
 * Deterministic pseudo-random generator so challenge creation is reproducible in
 * tests. Uses a mulberry32 step over the provided 32-bit seed.
 */
const nextRandom = (seed: number): { value: number; seed: number } => {
  let state = (seed + 0x6d2b79f5) | 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  state = t | 0;
  return { value, seed: state };
};

const randomInt = (
  seed: number,
  min: number,
  max: number,
): { value: number; seed: number } => {
  const next = nextRandom(seed);
  const span = max - min + 1;
  return { value: min + Math.floor(next.value * span), seed: next.seed };
};

export const normalizeAnswer = (value: string): string =>
  value.trim().toLowerCase();

export const hashCaptchaAnswer = (answer: string, salt: string): string =>
  createHash("sha256")
    .update(`${salt}:${normalizeAnswer(answer)}`)
    .digest("hex");

export const verifyCaptchaAnswer = (
  candidate: string,
  answerHash: string,
  salt: string,
): boolean => hashCaptchaAnswer(candidate, salt) === answerHash;

const buildButtonChallenge = (seed: number): CaptchaChallenge => {
  const animals = ["gato", "perro", "pez", "ave", "rana", "oso"];
  const pick = randomInt(seed, 0, animals.length - 1);
  const correctIndex = pick.value;
  const correct = animals[correctIndex] ?? "gato";
  const buttons: CaptchaButton[] = animals.map((label, index) => ({
    label,
    token: `opt_${index}`,
    correct: index === correctIndex,
  }));

  return {
    mode: "button",
    prompt: `Para verificarte, pulsa el boton: ${correct}`,
    answer: normalizeAnswer(`opt_${correctIndex}`),
    buttons,
  };
};

const buildMathChallenge = (seed: number): CaptchaChallenge => {
  const a = randomInt(seed, 1, 9);
  const b = randomInt(a.seed, 1, 9);
  const result = a.value + b.value;

  // Multiple-choice options so a restricted (muted) member can TAP the answer —
  // typing a number is impossible while send_messages is revoked. Correct sum +
  // 3 distinct non-negative distractors, shuffled deterministically over the seed.
  const options: number[] = [result];
  let cursor = b.seed;
  while (options.length < 4) {
    const delta = randomInt(cursor, -5, 5);
    cursor = delta.seed;
    const candidate = result + delta.value;
    if (candidate >= 0 && !options.includes(candidate)) {
      options.push(candidate);
    }
  }
  for (let index = options.length - 1; index > 0; index -= 1) {
    const pick = randomInt(cursor, 0, index);
    cursor = pick.seed;
    const swap = pick.value;
    const tmp = options[index] as number;
    options[index] = options[swap] as number;
    options[swap] = tmp;
  }
  const buttons: CaptchaButton[] = options.map((value) => ({
    label: String(value),
    token: String(value),
    correct: value === result,
  }));

  return {
    mode: "math",
    prompt: `Resuelve para verificarte: ${a.value} + ${b.value} = ?`,
    answer: normalizeAnswer(String(result)),
    buttons,
  };
};

const buildTextChallenge = (seed: number): CaptchaChallenge => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let current = seed;
  let code = "";

  for (let index = 0; index < 5; index += 1) {
    const pick = randomInt(current, 0, alphabet.length - 1);
    code += alphabet[pick.value];
    current = pick.seed;
  }

  return {
    mode: "text",
    prompt: `Escribe exactamente este codigo para verificarte: ${code}`,
    answer: normalizeAnswer(code),
    buttons: [],
  };
};

export const generateCaptchaChallenge = (
  mode: CaptchaMode,
  seed: number,
): CaptchaChallenge => {
  switch (mode) {
    case "math":
      return buildMathChallenge(seed);
    case "text":
      return buildTextChallenge(seed);
    default:
      return buildButtonChallenge(seed);
  }
};

export type CaptchaCommand =
  | { readonly kind: "help" }
  | { readonly kind: "status" }
  | { readonly kind: "enable"; readonly enabled: boolean }
  | { readonly kind: "mode"; readonly mode: CaptchaMode }
  | { readonly kind: "timeout"; readonly timeoutSeconds: number }
  | { readonly kind: "attempts"; readonly maxAttempts: number }
  | { readonly kind: "action"; readonly action: "ban" | "mute" | "restrict" }
  | { readonly kind: "test" };

export interface CaptchaCommandError {
  readonly code:
    | "invalid-mode"
    | "invalid-timeout"
    | "invalid-attempts"
    | "invalid-action";
  readonly usage: string;
}

export type CaptchaCommandResult =
  | { readonly ok: true; readonly command: CaptchaCommand }
  | { readonly ok: false; readonly error: CaptchaCommandError };

const captchaCommandNames: ReadonlySet<string> = new Set([
  "captcha",
  "captcha_on",
  "captcha_off",
  "captcha_status",
  "captcha_mode",
  "captcha_timeout",
  "captcha_attempts",
  "captcha_action",
  "captcha_test",
]);

const captchaActions: ReadonlySet<string> = new Set([
  "ban",
  "mute",
  "restrict",
]);

export const parseCaptchaCommand = (
  update: TelegramUpdateEnvelope,
): CaptchaCommandResult | null => {
  const name = update.command?.name;

  if (!name || !captchaCommandNames.has(name)) {
    return null;
  }

  const args = update.command?.args ?? [];

  switch (name) {
    case "captcha":
      return { ok: true, command: { kind: "help" } };
    case "captcha_status":
      return { ok: true, command: { kind: "status" } };
    case "captcha_on":
      return { ok: true, command: { kind: "enable", enabled: true } };
    case "captcha_off":
      return { ok: true, command: { kind: "enable", enabled: false } };
    case "captcha_test":
      return { ok: true, command: { kind: "test" } };
    case "captcha_mode": {
      const mode = (args[0] ?? "").toLowerCase();

      if (!captchaModes.has(mode)) {
        return {
          ok: false,
          error: {
            code: "invalid-mode",
            usage: "Uso: /captcha_mode <button|math|text>",
          },
        };
      }

      return { ok: true, command: { kind: "mode", mode: mode as CaptchaMode } };
    }
    case "captcha_timeout": {
      const timeoutSeconds = Number.parseInt(args[0] ?? "", 10);

      if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 10) {
        return {
          ok: false,
          error: {
            code: "invalid-timeout",
            usage: "Uso: /captcha_timeout <segundos>=10>",
          },
        };
      }

      return { ok: true, command: { kind: "timeout", timeoutSeconds } };
    }
    case "captcha_attempts": {
      const maxAttempts = Number.parseInt(args[0] ?? "", 10);

      if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
        return {
          ok: false,
          error: {
            code: "invalid-attempts",
            usage: "Uso: /captcha_attempts <intentos>",
          },
        };
      }

      return { ok: true, command: { kind: "attempts", maxAttempts } };
    }
    case "captcha_action": {
      const action = (args[0] ?? "").toLowerCase();

      if (!captchaActions.has(action)) {
        return {
          ok: false,
          error: {
            code: "invalid-action",
            usage: "Uso: /captcha_action <ban|mute|restrict>",
          },
        };
      }

      return {
        ok: true,
        command: {
          kind: "action",
          action: action as "ban" | "mute" | "restrict",
        },
      };
    }
    default:
      return null;
  }
};
