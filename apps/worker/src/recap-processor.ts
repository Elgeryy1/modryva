import type { ChatActivityEntry, ChatSettingRepository } from "@superbot/data";
import type { BotReply } from "@superbot/domain";
import type { AiProvider } from "@superbot/module-ai";
import { CHAT_QUIET_KEY, WEEKLY_RECAP_KEY } from "@superbot/shared";
import type { PublishGateway } from "./expiration-processor.js";

// Per-chat idempotency marker for the weekly recap: `{ lastWeek }` holds the
// last ISO-week key we posted for, so we announce exactly once per week even
// though the job ticks every minute. Stored under its own ChatSetting key so it
// never collides with the opt-in flag (WEEKLY_RECAP_KEY).
export const WEEKLY_RECAP_STATE_KEY = "weekly_recap_state";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

// A "don't bother" floor: a near-dead week isn't worth an unprompted post.
const MIN_MESSAGES_FOR_RECAP = 8;

const DAY_NAMES = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
] as const;

/**
 * Monday-aligned week index. 1970-01-01 was a Thursday, so `(days - 4)` lands a
 * whole-week boundary on each Monday 00:00 UTC; a new week (a new integer) thus
 * begins every Monday, which is when the recap fires.
 */
export const weekKeyFromMs = (nowMs: number): number =>
  Math.floor((Math.floor(nowMs / DAY_MS) - 4) / 7);

const readLastWeek = (raw: unknown): number | null => {
  if (raw && typeof raw === "object") {
    const value = (raw as Record<string, unknown>).lastWeek;
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
};

const isQuiet = (raw: unknown): boolean =>
  typeof raw === "object" &&
  raw !== null &&
  (raw as { enabled?: unknown }).enabled === true;

const isEnabled = (raw: unknown): boolean =>
  typeof raw === "object" &&
  raw !== null &&
  (raw as { enabled?: unknown }).enabled === true;

/** Aggregated, message-content-free stats for one group's week. */
export interface WeekSummary {
  messageCount: number;
  participantCount: number;
  topPosters: { name: string; count: number }[];
  busiestDay: string | null;
}

const posterName = (entry: ChatActivityEntry): string | null => {
  if (entry.username && entry.username.trim().length > 0) {
    return entry.username.startsWith("@")
      ? entry.username
      : `@${entry.username}`;
  }
  if (entry.telegramUserId !== undefined) {
    return `#${entry.telegramUserId.toString()}`;
  }
  return null;
};

/**
 * Reduce a chat's recent "message" activity log to the small, aggregated shape
 * the recap needs. PURE: no I/O, no message text leaves this function — only
 * counts and display names. Events older than 7 days from `nowMs` are ignored.
 */
export const summarizeWeek = (
  events: readonly ChatActivityEntry[],
  nowMs: number,
): WeekSummary => {
  const since = nowMs - WEEK_MS;
  const recent = events.filter((e) => e.createdAt.getTime() >= since);

  const byPoster = new Map<string, number>();
  const participants = new Set<string>();
  const byDay = new Map<number, number>();

  for (const e of recent) {
    const name = posterName(e);
    if (name) {
      byPoster.set(name, (byPoster.get(name) ?? 0) + 1);
      participants.add(name);
    }
    const day = e.createdAt.getUTCDay();
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }

  const topPosters = [...byPoster.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));

  let busiestDay: string | null = null;
  let bestDayCount = -1;
  for (const [day, count] of byDay) {
    if (count > bestDayCount) {
      bestDayCount = count;
      busiestDay = DAY_NAMES[day] ?? null;
    }
  }

  return {
    messageCount: recent.length,
    participantCount: participants.size,
    topPosters,
    busiestDay,
  };
};

/** The deterministic (no-AI) recap text — also the fallback when AI is off. */
export const renderStatsRecap = (s: WeekSummary): string => {
  const top = s.topPosters
    .map((p, i) => `${["🥇", "🥈", "🥉"][i] ?? "•"} ${p.name} (${p.count})`)
    .join("\n");
  const lines = [
    "🗓️ *Resumen de la semana*",
    "",
    `💬 ${s.messageCount} mensajes · 👥 ${s.participantCount} personas`,
  ];
  if (s.busiestDay) {
    lines.push(`🔥 Día más movido: ${s.busiestDay}`);
  }
  if (top) {
    lines.push("", "*Más activos:*", top);
  }
  return lines.join("\n");
};

/** The compact, content-free stats block handed to the AI narrator. */
const statsForAi = (s: WeekSummary): string =>
  [
    `mensajes: ${s.messageCount}`,
    `participantes: ${s.participantCount}`,
    `dia_mas_activo: ${s.busiestDay ?? "-"}`,
    `top: ${s.topPosters.map((p) => `${p.name}=${p.count}`).join(", ") || "-"}`,
  ].join("\n");

/**
 * Ask the AI to narrate the week in a warm 2-3 sentence paragraph, built ONLY
 * from the aggregated stats (never message content). Returns null on any failure
 * or when AI is disabled/degraded, so the caller falls back to the stats card.
 */
const narrateWithAi = async (
  ai: AiProvider,
  s: WeekSummary,
): Promise<string | null> => {
  try {
    const result = await ai.complete(
      [
        {
          role: "system",
          content:
            "Eres el asistente de una comunidad de Telegram. Escribe un resumen " +
            "semanal MUY corto (2-3 frases), cálido y natural, en español, a " +
            "partir de estas estadísticas agregadas. No inventes datos ni cites " +
            "mensajes (no los tienes). Puedes usar 1-2 emojis. No uses Markdown.",
        },
        { role: "user", content: statsForAi(s) },
      ],
      { task: "summarize_short", maxTokens: 220 },
    );
    const text = result.text?.trim();
    // "local" is the offline FakeAiProvider's reserved name (used whenever AI
    // is disabled/misconfigured) — its canned "Respuesta simulada" text must
    // never reach real groups; fall back to the deterministic stats card.
    if (!text || result.degraded || result.provider === "local") {
      return null;
    }
    return text;
  } catch {
    return null;
  }
};

export interface WeeklyRecapContext {
  readonly chatSetting: ChatSettingRepository;
  readonly gateway: PublishGateway;
  readonly ai: AiProvider;
  readonly resolveBotToken: (tenantId: string) => Promise<string | undefined>;
  readonly nowMs: number;
  listWeekEvents(
    tenantId: string,
    chatId: string,
  ): Promise<ChatActivityEntry[]>;
  resolveChatTelegramId(chatId: string): Promise<bigint | undefined>;
}

export interface WeeklyRecapSummary {
  scanned: number;
  posted: number;
  initialized: number;
  skipped: number;
  errors: number;
}

/**
 * community.recap.weekly — for every group that opted in (WEEKLY_RECAP_KEY
 * enabled), posts one short weekly summary when a new week opens (Monday). It is
 * idempotent per week via a `{lastWeek}` marker: the first sighting seeds the
 * week WITHOUT posting (so enabling mid-week never spams), and thereafter it
 * posts exactly once when the week advances.
 *
 * The recap is built entirely from aggregated ChatActivityEvent stats (never raw
 * message text); the AI, when available, only ever sees those stats. As an
 * unprompted post it defers to quiet mode, and it stays silent for near-dead
 * weeks (below MIN_MESSAGES_FOR_RECAP).
 */
export const processWeeklyRecap = async (
  ctx: WeeklyRecapContext,
): Promise<WeeklyRecapSummary> => {
  const summary: WeeklyRecapSummary = {
    scanned: 0,
    posted: 0,
    initialized: 0,
    skipped: 0,
    errors: 0,
  };

  const weekKey = weekKeyFromMs(ctx.nowMs);
  const entries = await ctx.chatSetting.listByKey(WEEKLY_RECAP_KEY);

  for (const entry of entries) {
    summary.scanned += 1;
    if (!isEnabled(entry.value)) {
      summary.skipped += 1;
      continue;
    }

    const stateRaw = await ctx.chatSetting.getValue(
      entry.tenantId,
      entry.chatId,
      WEEKLY_RECAP_STATE_KEY,
    );
    const lastWeek = readLastWeek(stateRaw);

    // First sighting: seed the current week without posting (no mid-week spam).
    if (lastWeek === null) {
      await ctx.chatSetting.setValue(
        entry.tenantId,
        entry.chatId,
        WEEKLY_RECAP_STATE_KEY,
        { lastWeek: weekKey },
      );
      summary.initialized += 1;
      continue;
    }
    if (weekKey <= lastWeek) {
      summary.skipped += 1;
      continue;
    }

    // A new week opened. Advance the marker FIRST so a post failure (or a
    // near-dead / silenced week) never re-triggers every minute for a week.
    await ctx.chatSetting.setValue(
      entry.tenantId,
      entry.chatId,
      WEEKLY_RECAP_STATE_KEY,
      { lastWeek: weekKey },
    );

    // Quiet mode: an unprompted post, so it stays silent if the bot is silenced.
    const quietRaw = await ctx.chatSetting.getValue(
      entry.tenantId,
      entry.chatId,
      CHAT_QUIET_KEY,
    );
    if (isQuiet(quietRaw)) {
      summary.skipped += 1;
      continue;
    }

    const events = await ctx.listWeekEvents(entry.tenantId, entry.chatId);
    const stats = summarizeWeek(events, ctx.nowMs);
    if (stats.messageCount < MIN_MESSAGES_FOR_RECAP) {
      summary.skipped += 1;
      continue;
    }

    const telegramChatId = await ctx.resolveChatTelegramId(entry.chatId);
    if (telegramChatId === undefined) {
      summary.skipped += 1;
      continue;
    }

    const narrative = await narrateWithAi(ctx.ai, stats);
    const reply: BotReply = narrative
      ? { text: `🗓️ ${narrative}` }
      : { text: renderStatsRecap(stats), parseMode: "Markdown" };

    try {
      const token = await ctx.resolveBotToken(entry.tenantId);
      const result = await ctx.gateway.sendMessage({
        chatId: telegramChatId,
        reply,
        token,
      });
      if (result.ok) {
        summary.posted += 1;
      } else {
        summary.errors += 1;
      }
    } catch {
      summary.errors += 1;
    }
  }

  return summary;
};
