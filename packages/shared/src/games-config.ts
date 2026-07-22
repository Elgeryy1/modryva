// Per-chat games + onboarding configuration. ONE source of truth for the api
// (reads/writes it), the web onboarding wizard (edits it) and the worker (reads
// it to decide when to announce a new trivia). Stored as JSON in the existing
// `ChatSetting` table under GAMES_CONFIG_KEY — 0 migration.
//
// The "purpose" is what the admin picks the first time they open the Mini App
// after adding the bot to a group: is this bot here to MODERATE, to run GAMES,
// or BOTH. It drives whether the bot ever posts anything in the chat (moderate
// = Mini-App-only, no chat noise; games/both = announce a fresh trivia).

import { z } from "zod";

/** ChatSetting key holding a group's GamesConfig JSON. */
export const GAMES_CONFIG_KEY = "games_config";
/** ChatSetting key holding the worker's last-announced trivia window per chat. */
export const GAMES_ANNOUNCE_STATE_KEY = "games_announce_state";

/** What the admin uses this bot for in this group. */
export type BotPurpose = "moderate" | "play" | "both";
export const BOT_PURPOSES: readonly BotPurpose[] = ["moderate", "play", "both"];

/** The toggleable games (portable + community) shown in the onboarding. */
export const GAME_TOGGLE_KEYS = [
  "tictactoe",
  "rps",
  "quiz",
  "dailytrivia",
  "boss",
] as const;
export type GameToggleKey = (typeof GAME_TOGGLE_KEYS)[number];

/** How often a fresh community trivia opens: once a day or every hour on the dot. */
export type TriviaCadence = "daily" | "hourly";

export interface GamesConfig {
  readonly purpose: BotPurpose;
  readonly games: Readonly<Record<GameToggleKey, boolean>>;
  readonly triviaCadence: TriviaCadence;
  /** Whether the bot posts a "new trivia" card in the chat (never for moderate). */
  readonly announce: boolean;
  /** True once the admin has completed onboarding at least once. */
  readonly configured: boolean;
}

/** Moderate-only bots never post in the chat; games/both bots announce. */
export const purposeAnnounces = (purpose: BotPurpose): boolean =>
  purpose !== "moderate";

const allGamesOn = (): Record<GameToggleKey, boolean> => ({
  tictactoe: true,
  rps: true,
  quiz: true,
  dailytrivia: true,
  boss: true,
});

/** A fresh config for a never-configured chat, defaulting to the given purpose. */
export const defaultGamesConfig = (
  purpose: BotPurpose = "both",
): GamesConfig => ({
  purpose,
  games: allGamesOn(),
  triviaCadence: "daily",
  announce: purposeAnnounces(purpose),
  configured: false,
});

/**
 * The purpose to pre-select in onboarding, derived from a child bot's template
 * (or the primary bot when template is null). A `support`/`business` bot leans
 * to moderation, a `creator` bot to games; `community`/`custom`/primary keep the
 * full "both" so nothing is hidden — the template only sets the sensible default.
 */
export const recommendedPurpose = (
  template: string | null | undefined,
): BotPurpose => {
  switch (template) {
    case "support":
    case "business":
      return "moderate";
    case "creator":
      return "play";
    default:
      return "both";
  }
};

const gameTogglesSchema = z.object({
  tictactoe: z.boolean(),
  rps: z.boolean(),
  quiz: z.boolean(),
  dailytrivia: z.boolean(),
  boss: z.boolean(),
});

/** Strict schema for the PUT body (the web onboarding sends a full config). */
export const gamesConfigSchema = z.object({
  purpose: z.enum(["moderate", "play", "both"]),
  games: gameTogglesSchema,
  triviaCadence: z.enum(["daily", "hourly"]),
  announce: z.boolean(),
  configured: z.boolean(),
});

/**
 * Lenient decode of whatever JSON is stored (or missing/partial/legacy): every
 * field falls back to a default, so a half-written or older shape never throws.
 */
export const parseGamesConfig = (raw: unknown): GamesConfig => {
  const base = defaultGamesConfig();
  if (!raw || typeof raw !== "object") {
    return base;
  }
  const obj = raw as Record<string, unknown>;
  const purpose = BOT_PURPOSES.includes(obj.purpose as BotPurpose)
    ? (obj.purpose as BotPurpose)
    : base.purpose;
  const gamesObj =
    obj.games && typeof obj.games === "object"
      ? (obj.games as Record<string, unknown>)
      : {};
  const games = allGamesOn();
  for (const key of GAME_TOGGLE_KEYS) {
    if (typeof gamesObj[key] === "boolean") {
      games[key] = gamesObj[key] as boolean;
    }
  }
  const triviaCadence: TriviaCadence =
    obj.triviaCadence === "hourly" ? "hourly" : "daily";
  const announce =
    typeof obj.announce === "boolean"
      ? obj.announce
      : purposeAnnounces(purpose);
  const configured =
    typeof obj.configured === "boolean" ? obj.configured : false;
  return { purpose, games, triviaCadence, announce, configured };
};
