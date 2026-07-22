// Canonical codec for the Telegram Mini App `startapp` payload. ONE source of
// truth for both the bot (which builds the deep links) and the api/web (which
// decode them). Telegram allows [A-Za-z0-9_-]{1,64}; group ids cross as STRINGS
// (they are large/negative and the web never handles bigint), so groupId is a
// string everywhere here — callers on the bot side do `.toString()` at the edge.

export const START_PARAM_RE = /^[A-Za-z0-9_-]{1,64}$/u;
const GAME_NAME_RE = /^[A-Za-z0-9-]{1,32}$/u;

export type StartParam =
  | { readonly kind: "config"; readonly groupId: string }
  | { readonly kind: "onboarding"; readonly groupId: string }
  | {
      readonly kind: "game";
      readonly groupId: string;
      readonly game: string;
    }
  | { readonly kind: "inlineGame"; readonly game: string }
  | { readonly kind: "gamesHub"; readonly groupId?: string };

export const encodeConfigStartParam = (groupId: string): string =>
  `cfg_${groupId}`;

// Onboarding entry: same group id as cfg_, but lands the admin on the purpose
// question ("what will you use this bot for?") instead of the config hub.
export const encodeOnboardingStartParam = (groupId: string): string =>
  `onb_${groupId}`;

export const encodeGameStartParam = (name: string, groupId: string): string => {
  if (!GAME_NAME_RE.test(name)) {
    throw new Error(`invalid game name: ${name}`);
  }
  return `game_${name}_${groupId}`;
};

export const encodeInlineGameStartParam = (name: string): string => {
  if (!GAME_NAME_RE.test(name)) {
    throw new Error(`invalid game name: ${name}`);
  }
  return `inline_${name}`;
};

// The games hub. With a group id (`games_<gid>`) play attributed to that group;
// without one (`games`) it stays on the portable board. `games_` never collides
// with the `game_` prefix (the trailing "s" differs).
export const encodeGamesHubStartParam = (groupId?: string): string =>
  groupId ? `games_${groupId}` : "games";

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
    // Split on the LAST underscore: the group id may be negative but never
    // contains an underscore, and the game name never does either.
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
    return game && GAME_NAME_RE.test(game)
      ? { kind: "inlineGame", game }
      : null;
  }

  if (param === "games") {
    return { kind: "gamesHub" };
  }

  // `games_<gid>`: group-scoped hub. Checked after `game_` (which it can't match
  // — "games_" has a trailing "s" before the underscore) and the bare `games`.
  if (param.startsWith("games_")) {
    const groupId = param.slice("games_".length);
    return groupId ? { kind: "gamesHub", groupId } : null;
  }

  return null;
};

export const buildMiniAppLink = (
  botUsername: string,
  appShortName: string,
  startParam: string,
): string =>
  `https://t.me/${botUsername}/${appShortName}?startapp=${startParam}`;
