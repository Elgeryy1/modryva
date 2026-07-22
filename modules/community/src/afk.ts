import type { TelegramUpdateEnvelope } from "@superbot/domain";

export type AfkCommand =
  | { readonly kind: "set"; readonly reason: string | undefined }
  | { readonly kind: "clear" };

export type AfkCommandResult = {
  readonly ok: true;
  readonly command: AfkCommand;
};

/**
 * A user currently marked as AFK. `sinceMs` is the epoch timestamp (ms) at
 * which the user went AFK; callers provide it so this module stays pure.
 */
export interface AfkUser {
  readonly telegramUserId: bigint;
  readonly username: string | undefined;
  readonly reason: string | undefined;
  readonly sinceMs: number;
}

const afkCommandNames: ReadonlySet<string> = new Set(["afk", "back", "unafk"]);

/**
 * Parses `/afk [motivo]` into `{ kind: "set" }` and `/back` (alias `/unafk`)
 * into `{ kind: "clear" }`. `/afk` without motivo is valid (reason becomes
 * undefined), so this module has no format errors. Returns null when the
 * update does not carry one of the AFK commands. Pure and deterministic.
 */
export const parseAfkCommand = (
  update: TelegramUpdateEnvelope,
): AfkCommandResult | null => {
  const name = update.command?.name;

  if (!name || !afkCommandNames.has(name)) {
    return null;
  }

  if (name === "afk") {
    const reason = (update.command?.args ?? []).join(" ").trim();
    return {
      ok: true,
      command: { kind: "set", reason: reason.length > 0 ? reason : undefined },
    };
  }

  return { ok: true, command: { kind: "clear" } };
};

const mentionPattern = /@([a-zA-Z0-9_]{3,32})/g;

/**
 * Extracts `@username` mentions from a text, lowercased and without
 * duplicates, preserving first-appearance order. Returns an empty array for
 * undefined or mention-less text. Pure and deterministic.
 */
export const extractMentions = (text: string | undefined): string[] => {
  if (!text) {
    return [];
  }

  const seen = new Set<string>();
  const mentions: string[] = [];

  for (const match of text.matchAll(mentionPattern)) {
    const username = (match[1] ?? "").toLowerCase();
    if (username && !seen.has(username)) {
      seen.add(username);
      mentions.push(username);
    }
  }

  return mentions;
};

/**
 * Returns the AFK users whose username is mentioned in the text
 * (case-insensitive). AFK users without username never match. Preserves the
 * order of `afkUsers`. Pure and deterministic.
 */
export const findMentionedAfkUsers = (
  text: string | undefined,
  afkUsers: readonly AfkUser[],
): AfkUser[] => {
  const mentions = new Set(extractMentions(text));

  if (mentions.size === 0) {
    return [];
  }

  return afkUsers.filter(
    (user) =>
      user.username !== undefined && mentions.has(user.username.toLowerCase()),
  );
};

/**
 * Formats a duration in milliseconds as a compact Spanish-neutral string:
 * `"<1m"` under one minute (also for negative inputs), `"5m"`, `"2h 3m"`,
 * `"1d 4h"`. Zero remainders are omitted (`"2h"`, `"1d"`). Pure and
 * deterministic.
 */
export const formatAfkDuration = (ms: number): string => {
  if (ms < 60_000) {
    return "<1m";
  }

  const totalMinutes = Math.floor(ms / 60_000);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  if (totalHours > 0) {
    return minutes > 0 ? `${totalHours}h ${minutes}m` : `${totalHours}h`;
  }

  return `${totalMinutes}m`;
};

/**
 * Builds the notice shown when someone mentions an AFK user, e.g.
 * `"💤 @username esta AFK desde hace 2h 3m: motivo"`. Without reason the
 * colon part is omitted; without username the user is named "ese usuario".
 * Deterministic: the duration derives from `nowMs - user.sinceMs`.
 */
export const buildAfkNotice = (user: AfkUser, nowMs: number): string => {
  const who = user.username ? `@${user.username}` : "ese usuario";
  const duration = formatAfkDuration(nowMs - user.sinceMs);
  const suffix = user.reason ? `: ${user.reason}` : "";
  return `💤 ${who} esta AFK desde hace ${duration}${suffix}`;
};

/**
 * Builds the confirmation reply for `/afk`, including the motivo when given.
 * Pure and deterministic.
 */
export const buildAfkSetReply = (reason: string | undefined): string =>
  reason ? `💤 Marcado como AFK: ${reason}` : "💤 Marcado como AFK.";

/**
 * Builds the welcome-back reply for `/back`, e.g.
 * `"👋 Bienvenido de vuelta! Estuviste AFK 2h 3m."`. Deterministic: the
 * duration derives from `nowMs - sinceMs`.
 */
export const buildAfkClearReply = (sinceMs: number, nowMs: number): string =>
  `👋 Bienvenido de vuelta! Estuviste AFK ${formatAfkDuration(nowMs - sinceMs)}.`;
