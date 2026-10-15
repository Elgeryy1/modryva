import type { TelegramUpdateEnvelope } from "@superbot/domain";

export type WelcomeCommand =
  | { readonly kind: "set-welcome"; readonly text: string }
  | { readonly kind: "show-welcome" }
  | { readonly kind: "reset-welcome" }
  | { readonly kind: "set-rules"; readonly text: string }
  | { readonly kind: "show-rules" }
  | { readonly kind: "set-goodbye"; readonly text: string };

export interface WelcomeCommandError {
  readonly code: "text-required";
  readonly usage: string;
}

export type WelcomeCommandResult =
  | { readonly ok: true; readonly command: WelcomeCommand }
  | { readonly ok: false; readonly error: WelcomeCommandError };

const welcomeCommandNames: ReadonlySet<string> = new Set([
  "setwelcome",
  "welcome",
  "resetwelcome",
  "setrules",
  "rules",
  "setgoodbye",
]);

export const parseWelcomeCommand = (
  update: TelegramUpdateEnvelope,
): WelcomeCommandResult | null => {
  const name = update.command?.name;

  if (!name || !welcomeCommandNames.has(name)) {
    return null;
  }

  const text = (update.command?.args ?? []).join(" ").trim();

  switch (name) {
    case "welcome":
      return { ok: true, command: { kind: "show-welcome" } };
    case "resetwelcome":
      return { ok: true, command: { kind: "reset-welcome" } };
    case "rules":
      return { ok: true, command: { kind: "show-rules" } };
    case "setwelcome":
      return text
        ? { ok: true, command: { kind: "set-welcome", text } }
        : {
            ok: false,
            error: {
              code: "text-required",
              usage: "Uso: /setwelcome <mensaje>",
            },
          };
    case "setrules":
      return text
        ? { ok: true, command: { kind: "set-rules", text } }
        : {
            ok: false,
            error: { code: "text-required", usage: "Uso: /setrules <texto>" },
          };
    case "setgoodbye":
      return text
        ? { ok: true, command: { kind: "set-goodbye", text } }
        : {
            ok: false,
            error: {
              code: "text-required",
              usage: "Uso: /setgoodbye <mensaje>",
            },
          };
    default:
      return null;
  }
};

/**
 * Substitutes `{key}` placeholders with the provided values. Unknown placeholders
 * are replaced with an empty string so raw template tokens never leak to users.
 */
export const renderTemplate = (
  template: string,
  vars: Readonly<Record<string, string>>,
): string =>
  template.replace(/\{([a-z_]+)\}/gu, (_match, key: string) =>
    Object.hasOwn(vars, key) ? (vars[key] ?? "") : "",
  );

export const defaultWelcomeTemplate = "Bienvenido {first_name} a {chat_title}.";

// --- GroupHelp-style welcome buttons (photo caption / message keyboard) ---

/**
 * Button kinds an admin can attach to a welcome message:
 * - `rules`          → popup with the group's rules (callback, no URL)
 * - `url`            → external link (requires a http(s)/tg URL)
 * - `contact_admins` → popup listing the group admins (callback, no URL)
 * - `miniapp`        → opens the group's Mini App (deep link, no URL needed)
 */
export type WelcomeButtonType = "rules" | "url" | "contact_admins" | "miniapp";

export interface WelcomeButton {
  readonly type: WelcomeButtonType;
  readonly text: string;
  /** Only meaningful for `url` buttons. */
  readonly url?: string;
}

/** callback_data carried by the built-in rules / contact-admins buttons. Kept
 * tiny (well under Telegram's 64-byte limit) — the chat is read from the
 * callback query itself, so no id needs to travel in the payload. */
export const WELCOME_RULES_CALLBACK = "wrules";
export const WELCOME_ADMINS_CALLBACK = "wadm";

const MAX_WELCOME_BUTTONS = 6;
const MAX_WELCOME_BUTTON_TEXT = 64;
const WELCOME_BUTTON_TYPES: ReadonlySet<string> = new Set<WelcomeButtonType>([
  "rules",
  "url",
  "contact_admins",
  "miniapp",
]);

const isSafeButtonUrl = (url: string): boolean =>
  /^(https?:\/\/|tg:\/\/)/iu.test(url);

/**
 * Coerces an untrusted value (a Prisma JSON column, or a request body) into a
 * safe, bounded list of welcome buttons. Never throws: malformed entries are
 * dropped so one bad button can't break the whole welcome. `url` buttons
 * without a safe URL are discarded (defense-in-depth against the API layer).
 */
export const parseWelcomeButtons = (value: unknown): WelcomeButton[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const buttons: WelcomeButton[] = [];
  for (const raw of value) {
    if (buttons.length >= MAX_WELCOME_BUTTONS) {
      break;
    }
    if (typeof raw !== "object" || raw === null) {
      continue;
    }
    const record = raw as { type?: unknown; text?: unknown; url?: unknown };
    if (
      typeof record.type !== "string" ||
      !WELCOME_BUTTON_TYPES.has(record.type)
    ) {
      continue;
    }
    const type = record.type as WelcomeButtonType;
    const text =
      typeof record.text === "string"
        ? record.text.trim().slice(0, MAX_WELCOME_BUTTON_TEXT)
        : "";
    if (!text) {
      continue;
    }
    if (type === "url") {
      const url = typeof record.url === "string" ? record.url.trim() : "";
      if (!isSafeButtonUrl(url)) {
        continue;
      }
      buttons.push({ type, text, url });
    } else {
      buttons.push({ type, text });
    }
  }
  return buttons;
};

export interface WelcomeKeyboardContext {
  readonly botUsername: string;
  readonly miniAppName: string;
}

const welcomeButtonToTelegram = (
  button: WelcomeButton,
  ctx: WelcomeKeyboardContext,
): Record<string, unknown> | null => {
  switch (button.type) {
    case "url":
      return button.url ? { text: button.text, url: button.url } : null;
    case "rules":
      return { text: button.text, callback_data: WELCOME_RULES_CALLBACK };
    case "contact_admins":
      return { text: button.text, callback_data: WELCOME_ADMINS_CALLBACK };
    case "miniapp":
      // web_app buttons are rejected by Telegram in groups, so a welcome (always
      // a group message) uses the named Mini App deep link instead.
      return ctx.botUsername && ctx.miniAppName
        ? {
            text: button.text,
            url: `https://t.me/${ctx.botUsername}/${ctx.miniAppName}`,
          }
        : null;
    default:
      return null;
  }
};

/**
 * Builds an inline keyboard (one button per row) from the stored welcome
 * buttons. Returns `undefined` when nothing renders, so the caller can omit
 * `reply_markup` entirely.
 */
export const buildWelcomeInlineKeyboard = (
  buttons: readonly WelcomeButton[],
  ctx: WelcomeKeyboardContext,
): { readonly inline_keyboard: Record<string, unknown>[][] } | undefined => {
  const rows: Record<string, unknown>[][] = [];
  for (const button of buttons) {
    const rendered = welcomeButtonToTelegram(button, ctx);
    if (rendered) {
      rows.push([rendered]);
    }
  }
  return rows.length > 0 ? { inline_keyboard: rows } : undefined;
};
