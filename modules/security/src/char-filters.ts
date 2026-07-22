import type { TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * ChatKeeper-style "face control": filter messages whose text is mostly written
 * in a script the group does not want (RTL — Arabic/Hebrew — or CJK — Chinese/
 * Japanese/Korean). Pure detection + config command; the ambient deletion lives
 * in the service. Only letters count toward the ratio, so emoji/punctuation do
 * not skew short messages.
 */

const RTL_RANGE = /[֐-ࣿיִ-﷿ﹰ-﻿]/u;
const CJK_RANGE = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/u;
const LETTER = /\p{L}/u;

const ratio = (text: string, range: RegExp): number => {
  let letters = 0;
  let matches = 0;
  for (const ch of text) {
    if (LETTER.test(ch)) {
      letters += 1;
      if (range.test(ch)) {
        matches += 1;
      }
    }
  }
  return letters === 0 ? 0 : matches / letters;
};

/** Fraction (0..1) of letters that are RTL (Arabic/Hebrew) script. */
export const rtlRatio = (text: string): number => ratio(text, RTL_RANGE);

/** Fraction (0..1) of letters that are CJK script. */
export const cjkRatio = (text: string): number => ratio(text, CJK_RANGE);

export const CHAR_FILTER_THRESHOLD = 0.5;

export interface CharFilterConfig {
  readonly rtlFilter: boolean;
  readonly cjkFilter: boolean;
}

/**
 * True when the text should be filtered given the group's config: a message with
 * more than half its letters in a disallowed script (and at least 4 letters, to
 * avoid nuking a stray word).
 */
export const shouldFilterByChars = (
  text: string,
  config: CharFilterConfig,
): boolean => {
  const letters = [...text].filter((ch) => LETTER.test(ch)).length;
  if (letters < 4) {
    return false;
  }
  if (config.rtlFilter && rtlRatio(text) > CHAR_FILTER_THRESHOLD) {
    return true;
  }
  if (config.cjkFilter && cjkRatio(text) > CHAR_FILTER_THRESHOLD) {
    return true;
  }
  return false;
};

export type CharFilterCommand =
  | { readonly kind: "rtl"; readonly enabled: boolean }
  | { readonly kind: "cjk"; readonly enabled: boolean };

export interface CharFilterCommandError {
  readonly code: "invalid-toggle";
  readonly usage: string;
}

export type CharFilterCommandResult =
  | { readonly ok: true; readonly command: CharFilterCommand }
  | { readonly ok: false; readonly error: CharFilterCommandError };

const on: ReadonlySet<string> = new Set(["on", "si", "true", "1"]);
const off: ReadonlySet<string> = new Set(["off", "no", "false", "0"]);

/** Parses `/rtlfilter on|off` and `/cjkfilter on|off`. */
export const parseCharFilterCommand = (
  update: TelegramUpdateEnvelope,
): CharFilterCommandResult | null => {
  const name = update.command?.name;

  if (name !== "rtlfilter" && name !== "cjkfilter") {
    return null;
  }

  const raw = update.command?.args?.[0]?.toLowerCase();
  const enabled =
    raw && on.has(raw) ? true : raw && off.has(raw) ? false : null;

  if (enabled === null) {
    return {
      ok: false,
      error: { code: "invalid-toggle", usage: `Uso: /${name} on|off` },
    };
  }

  return {
    ok: true,
    command:
      name === "rtlfilter"
        ? { kind: "rtl", enabled }
        : { kind: "cjk", enabled },
  };
};
