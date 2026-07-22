import type { TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * Quotly-style quote stickers: pure command parsing + payload building for a
 * `/q` command that turns the replied-to message into a Telegram-styled quote
 * image. The heavy lifting (rendering) is done by an injectable renderer; this
 * module only decides WHAT to render, so it stays deterministic and testable.
 */

export type QuoteFormat = "webp" | "png";

export interface QuoteCommand {
  readonly format: QuoteFormat;
  readonly color: string | undefined;
}

export type QuoteCommandResult = {
  readonly ok: true;
  readonly command: QuoteCommand;
};

const quoteCommandNames: ReadonlySet<string> = new Set(["q", "quote", "quot"]);

const namedColors: Readonly<Record<string, string>> = {
  red: "#e0245e",
  rojo: "#e0245e",
  blue: "#1da1f2",
  azul: "#1da1f2",
  green: "#17bf63",
  verde: "#17bf63",
  orange: "#f45d22",
  naranja: "#f45d22",
  purple: "#794bc4",
  morado: "#794bc4",
  pink: "#ff6b9d",
  rosa: "#ff6b9d",
  yellow: "#ffad1f",
  amarillo: "#ffad1f",
  gray: "#657786",
  grey: "#657786",
  gris: "#657786",
  black: "#0e0e10",
  negro: "#0e0e10",
  white: "#ffffff",
  blanco: "#ffffff",
};

const hexPattern = /^#?[0-9a-f]{6}$/iu;

/**
 * Resolves a colour argument to a `#rrggbb` string: accepts raw hex (with or
 * without `#`) and a set of named colours (Spanish/English). Returns undefined
 * for anything else so the caller can fall back to the default background.
 */
export const resolveQuoteColor = (
  raw: string | undefined,
): string | undefined => {
  if (!raw) {
    return undefined;
  }

  const value = raw.trim().toLowerCase();

  if (hexPattern.test(value)) {
    return value.startsWith("#") ? value : `#${value}`;
  }

  return namedColors[value];
};

/**
 * Parses `/q` (aliases `/quote`, `/quot`). Options are order-independent:
 * `png` selects the PNG format (default webp, sent as a sticker) and any known
 * colour name or hex sets the background. Returns null when the command is not
 * a quote command.
 */
export const parseQuoteCommand = (
  update: TelegramUpdateEnvelope,
): QuoteCommandResult | null => {
  const name = update.command?.name;

  if (!name || !quoteCommandNames.has(name)) {
    return null;
  }

  const args = (update.command?.args ?? []).map((arg) => arg.toLowerCase());
  const format: QuoteFormat = args.includes("png") ? "png" : "webp";
  const color = args
    .map(resolveQuoteColor)
    .find((value): value is string => value !== undefined);

  return {
    ok: true,
    command: { format, ...(color ? { color } : { color: undefined }) },
  };
};

export interface QuoteSource {
  readonly fromId: number;
  readonly name: string;
  readonly username: string | undefined;
  readonly text: string;
}

const readString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

/**
 * Extracts the quotable message (author + text) from the replied-to message in
 * a raw Telegram update. Returns null when there is no reply or no text/caption
 * to quote.
 */
export const extractQuoteSource = (raw: unknown): QuoteSource | null => {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const message = (raw as { message?: unknown }).message;

  if (typeof message !== "object" || message === null) {
    return null;
  }

  const reply = (message as { reply_to_message?: unknown }).reply_to_message;

  if (typeof reply !== "object" || reply === null) {
    return null;
  }

  const replyObj = reply as {
    text?: unknown;
    caption?: unknown;
    from?: unknown;
  };
  const from = replyObj.from;

  if (typeof from !== "object" || from === null) {
    return null;
  }

  const fromObj = from as {
    id?: unknown;
    first_name?: unknown;
    last_name?: unknown;
    username?: unknown;
  };

  if (typeof fromObj.id !== "number") {
    return null;
  }

  const text = readString(replyObj.text) ?? readString(replyObj.caption);

  if (!text) {
    return null;
  }

  const name =
    [readString(fromObj.first_name), readString(fromObj.last_name)]
      .filter((part): part is string => part !== undefined)
      .join(" ") || "Anonimo";

  return {
    fromId: fromObj.id,
    name,
    username: readString(fromObj.username),
    text,
  };
};

export interface QuoteMessagePayload {
  readonly entities: readonly unknown[];
  readonly avatar: boolean;
  readonly from: {
    readonly id: number;
    readonly name: string;
    readonly username?: string;
  };
  readonly text: string;
  readonly replyMessage: Record<string, unknown>;
}

export interface QuotePayload {
  readonly type: "quote";
  readonly format: QuoteFormat;
  readonly backgroundColor: string;
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  readonly messages: readonly QuoteMessagePayload[];
}

export const DEFAULT_QUOTE_BACKGROUND = "#1b1429";

/**
 * Builds the request body for the quote renderer (LyoSU quote-api shape). Pure:
 * identical inputs always produce an identical payload.
 */
export const buildQuotePayload = (input: {
  readonly source: QuoteSource;
  readonly format: QuoteFormat;
  readonly color: string | undefined;
}): QuotePayload => ({
  type: "quote",
  format: input.format,
  backgroundColor: input.color ?? DEFAULT_QUOTE_BACKGROUND,
  width: 512,
  height: 768,
  scale: 2,
  messages: [
    {
      entities: [],
      avatar: true,
      from: {
        id: input.source.fromId,
        name: input.source.name,
        ...(input.source.username ? { username: input.source.username } : {}),
      },
      text: input.source.text,
      replyMessage: {},
    },
  ],
});
