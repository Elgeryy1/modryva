import type { TelegramUpdateEnvelope } from "@superbot/domain";

export type StatsCommand =
  | { readonly kind: "summary" }
  | { readonly kind: "activity" }
  | { readonly kind: "top" };

export type StatsCommandResult = {
  readonly ok: true;
  readonly command: StatsCommand;
};

const statsCommandNames: ReadonlySet<string> = new Set([
  "stats",
  "activity",
  "topposters",
  "topmsg",
  "topactive",
]);

export const parseStatsCommand = (
  update: TelegramUpdateEnvelope,
): StatsCommandResult | null => {
  const name = update.command?.name;

  if (!name || !statsCommandNames.has(name)) {
    return null;
  }

  const kind: StatsCommand["kind"] =
    name === "activity" ? "activity" : name === "stats" ? "summary" : "top";

  return { ok: true, command: { kind } };
};

/**
 * Formats a Combot-style top-posters ranking with podium medals.
 */
export const formatTopPosters = (
  rows: readonly {
    readonly telegramUserId: bigint;
    readonly username: string | undefined;
    readonly messages: number;
  }[],
): string => {
  if (rows.length === 0) {
    return "Aun no hay actividad registrada.";
  }

  const medals = ["🥇", "🥈", "🥉"];
  const lines = rows.map((row, index) => {
    const rank = medals[index] ?? `${index + 1}.`;
    const who = row.username
      ? `@${row.username}`
      : row.telegramUserId.toString();
    return `${rank} ${who} — ${row.messages} msg`;
  });

  return `🏆 *Usuarios mas activos*\n${lines.join("\n")}`;
};

/**
 * UTC day bucket (YYYY-MM-DD) for a timestamp in milliseconds. Pure and stable so
 * the same instant always maps to the same bucket regardless of server locale.
 */
export const dayKeyFromMs = (ms: number): string =>
  new Date(ms).toISOString().slice(0, 10);

export interface ActivityWindow {
  readonly day: string;
  readonly messages: number;
}

/**
 * Sums the message counts for the most recent `days` buckets. The input may hold
 * arbitrary days; only those within the window relative to `todayKey` count.
 */
export const sumRecentMessages = (
  windows: readonly ActivityWindow[],
  todayMs: number,
  days: number,
): number => {
  const earliest = dayKeyFromMs(todayMs - (days - 1) * 86_400_000);

  return windows
    .filter((window) => window.day >= earliest)
    .reduce((total, window) => total + window.messages, 0);
};
