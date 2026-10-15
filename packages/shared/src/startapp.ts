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
  | { readonly kind: "gamesHub"; readonly groupId?: string }
  /** Appointed-admin panel for one group (the /adminlist screen). */
  | { readonly kind: "appointedAdmins"; readonly groupId: string }
  | { readonly kind: "economy"; readonly groupId: string }
  /** La tienda del grupo, para cualquiera del grupo — no solo para admins. */
  | { readonly kind: "shop"; readonly groupId: string }
  /** La mascota de quien abre, en su grupo. Como la tienda: para cualquiera. */
  | { readonly kind: "pet"; readonly groupId: string }
  /** A specific two-player match, opened from the group's invite message. */
  | { readonly kind: "match"; readonly matchId: string }
  /** Guardian verification roster (the /bdani screen). `groupId: null` asks for
   * the cross-group view, which the api narrows to the groups the caller
   * actually administers — the deep link is a request, never a grant. */
  | { readonly kind: "roster"; readonly groupId: string | null };

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

/** Guardian verification roster for a group (`/bdani`). */
export const encodeRosterStartParam = (groupId: string): string =>
  `bd_${groupId}`;

/** The same screen across every group the caller administers (`/bdani todos`).
 * A literal, not a group id — group ids are numeric, so this can never collide
 * with one. */
export const ROSTER_ALL_START_PARAM = "bd_all";

/** Appointed-admin panel for a group (`/adminlist`). */
export const encodeAppointedAdminsStartParam = (groupId: string): string =>
  `adm_${groupId}`;

/** Economia del grupo: moneda, robo y purga (`/settings` -> Economia). */
export const encodeEconomyStartParam = (groupId: string): string =>
  `eco_${groupId}`;

/**
 * La tienda del grupo (`/tienda`).
 *
 * Prefijo propio y no `eco_` porque no es la misma pantalla ni el mismo
 * publico: aquella son los ajustes y solo la abren admins, y esta la abre
 * cualquiera del grupo para gastarse lo que tiene.
 */
export const encodeShopStartParam = (groupId: string): string =>
  `shop_${groupId}`;

/**
 * El bicho del grupo.
 *
 * Prefijo propio y no un reuso de `shop_`: la pantalla es otra y el dia que
 * alguien comparta el enlace tiene que llevar a su mascota, no a la tienda.
 */
export const encodePetStartParam = (groupId: string): string =>
  `pet_${groupId}`;

/** Deep link straight into one match (the group invite's button). */
export const encodeMatchStartParam = (matchId: string): string =>
  `m_${matchId}`;

export const decodeStartParam = (
  param: string | null | undefined,
): StartParam | null => {
  if (!param || !START_PARAM_RE.test(param)) {
    return null;
  }

  // Before the generic branches: a cuid is [a-z0-9] only, so `m_` can never be
  // confused with the other prefixes, none of which start with a lone "m".
  if (param.startsWith("m_")) {
    const matchId = param.slice("m_".length);
    return matchId ? { kind: "match", matchId } : null;
  }

  // Checked BEFORE the generic `bd_` branch, which would otherwise read "all"
  // as a group id and hand the api a chat that does not exist.
  if (param === ROSTER_ALL_START_PARAM) {
    return { kind: "roster", groupId: null };
  }

  if (param.startsWith("bd_")) {
    const groupId = param.slice("bd_".length);
    return groupId ? { kind: "roster", groupId } : null;
  }

  if (param.startsWith("adm_")) {
    const groupId = param.slice("adm_".length);
    return groupId ? { kind: "appointedAdmins", groupId } : null;
  }

  if (param.startsWith("eco_")) {
    const groupId = param.slice("eco_".length);
    return groupId ? { kind: "economy", groupId } : null;
  }

  if (param.startsWith("pet_")) {
    const groupId = param.slice("pet_".length);
    return groupId ? { kind: "pet", groupId } : null;
  }

  if (param.startsWith("shop_")) {
    const groupId = param.slice("shop_".length);
    return groupId ? { kind: "shop", groupId } : null;
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
