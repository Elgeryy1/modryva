// Web-local copy of the small config metadata + start-param codec. The web must
// NOT import VALUES from @superbot/shared's barrel — it re-exports logger (pino)
// and env (zod), which drag server-only deps into the client bundle. Type-only
// imports from @superbot/shared are fine (erased at build). Keep in sync with
// packages/shared/src/{startapp,miniapp-contracts}.ts.

export const SECTION_NAMES = [
  "behavior",
  "welcome",
  "rules",
  "flood",
  "captcha",
  "locks",
  "warns",
  "hygiene",
  "membershipGate",
  "raid",
] as const;
export type SectionName = (typeof SECTION_NAMES)[number];
export const isSectionName = (value: string): value is SectionName =>
  (SECTION_NAMES as readonly string[]).includes(value);

export const FLOOD_ACTIONS = ["warn", "mute", "ban", "delete"] as const;
export const WARN_MODES = ["ban", "kick", "mute", "tban", "tmute"] as const;
export const BLOCKLIST_MODES = [
  "delete",
  "warn",
  "mute",
  "ban",
  "kick",
] as const;
export const CAPTCHA_MODES = ["button", "math", "text"] as const;
export const CAPTCHA_FAIL_ACTIONS = ["mute", "ban", "restrict"] as const;
export const ANTIRAID_MODES = ["observe", "enforce"] as const;
export const LOCK_TYPES = [
  "text",
  "url",
  "mention",
  "forward",
  "via_bot",
  "photo",
  "video",
  "gif",
  "sticker",
  "audio",
  "voice",
  "document",
  "contact",
  "location",
  "poll",
] as const;

const START_PARAM_RE = /^[A-Za-z0-9_-]{1,64}$/u;

export type StartParam =
  | { kind: "config"; groupId: string }
  | { kind: "onboarding"; groupId: string }
  | { kind: "game"; groupId: string; game: string }
  | { kind: "inlineGame"; game: string }
  | { kind: "gamesHub"; groupId?: string };

export const decodeStartParam = (
  param: string | null | undefined,
): StartParam | null => {
  if (!param || !START_PARAM_RE.test(param)) {
    return null;
  }
  if (param.startsWith("cfg_")) {
    const groupId = param.slice("cfg_".length);
    return groupId ? { kind: "config", groupId } : null;
  }
  if (param.startsWith("onb_")) {
    const groupId = param.slice("onb_".length);
    return groupId ? { kind: "onboarding", groupId } : null;
  }
  if (param.startsWith("game_")) {
    const rest = param.slice("game_".length);
    const sep = rest.lastIndexOf("_");
    if (sep <= 0 || sep === rest.length - 1) {
      return null;
    }
    return {
      kind: "game",
      game: rest.slice(0, sep),
      groupId: rest.slice(sep + 1),
    };
  }
  if (param.startsWith("inline_")) {
    const game = param.slice("inline_".length);
    return game ? { kind: "inlineGame", game } : null;
  }
  if (param === "games") {
    return { kind: "gamesHub" };
  }
  // Group-scoped hub `games_<gid>` (mirror of @superbot/shared). Checked after
  // `game_` (which it can't match — trailing "s") and the bare `games`.
  if (param.startsWith("games_")) {
    const groupId = param.slice("games_".length);
    return groupId ? { kind: "gamesHub", groupId } : null;
  }
  return null;
};
