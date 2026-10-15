import type { TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * Lightweight per-group i18n. A `/lang` command sets the group's language; the
 * `t()` helper resolves a message key against a string table with `{var}`
 * interpolation. The table starts with the highest-traffic user-facing strings;
 * new keys fall back to Spanish (and then the key itself) so nothing ever breaks
 * when a translation is missing.
 */

export const SUPPORTED_LANGS = ["es", "en"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

const LANG_NAMES: Record<Lang, string> = {
  es: "Espanol",
  en: "English",
};

type Table = Record<string, Partial<Record<Lang, string>>>;

const STRINGS: Table = {
  "welcome.default": {
    es: "Bienvenido {first_name} a {chat_title}.",
    en: "Welcome {first_name} to {chat_title}.",
  },
  "lang.set": {
    es: "🌐 Idioma del grupo: {lang}.",
    en: "🌐 Group language: {lang}.",
  },
  "lang.usage": {
    es: "Uso: /lang es|en",
    en: "Usage: /lang es|en",
  },
  "mod.no_permission": {
    es: "No tienes permisos para esto.",
    en: "You don't have permission to do this.",
  },
  "reminder.set": {
    es: 'Te recordare "{text}" el {when}.',
    en: 'I will remind you "{text}" on {when}.',
  },
};

const isLang = (value: string): value is Lang =>
  (SUPPORTED_LANGS as readonly string[]).includes(value);

export const normalizeLang = (value: string | undefined): Lang =>
  value && isLang(value) ? value : "es";

/**
 * Resolves a message key for a language with `{var}` interpolation. Falls back
 * to Spanish, then to the raw key, so a missing translation is safe.
 */
export const t = (
  key: string,
  lang: string,
  vars: Readonly<Record<string, string>> = {},
): string => {
  const entry = STRINGS[key];
  const template = entry?.[normalizeLang(lang)] ?? entry?.es ?? key;
  return template.replace(/\{([a-z_]+)\}/gu, (_m, name: string) =>
    Object.hasOwn(vars, name) ? (vars[name] ?? "") : "",
  );
};

export type LangCommandResult =
  | { readonly ok: true; readonly command: { readonly lang: Lang } }
  | { readonly ok: false; readonly error: { readonly usage: string } };

/**
 * Parses `/lang <es|en>`. Returns null when the command is not `/lang`.
 */
export const parseLangCommand = (
  update: TelegramUpdateEnvelope,
): LangCommandResult | null => {
  if (update.command?.name !== "lang") {
    return null;
  }

  const raw = update.command?.args?.[0]?.toLowerCase();

  if (!raw || !isLang(raw)) {
    return {
      ok: false,
      error: { usage: `Uso: /lang ${SUPPORTED_LANGS.join("|")}` },
    };
  }

  return { ok: true, command: { lang: raw } };
};

export const langDisplayName = (lang: string): string =>
  LANG_NAMES[normalizeLang(lang)];
