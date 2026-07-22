import type { ChatSettingRepository } from "@superbot/data";
import type { BotReply } from "@superbot/domain";
import { dayKeyFromMs, hourKeyFromMs } from "@superbot/module-games";
import {
  encodeGameStartParam,
  GAMES_ANNOUNCE_STATE_KEY,
  GAMES_CONFIG_KEY,
  parseGamesConfig,
  type TriviaCadence,
} from "@superbot/shared";
import type { PublishGateway } from "./expiration-processor.js";

// Match the api's daily/hourly trivia window: UTC buckets so every member of a
// group shares the same question in the same window, regardless of timezone.
const ANNOUNCE_TZ_OFFSET_MIN = 0;

export interface TriviaAnnounceContext {
  readonly chatSetting: ChatSettingRepository;
  readonly gateway: PublishGateway;
  readonly token: string | undefined;
  readonly primaryBotUsername: string;
  readonly miniAppName: string;
  /** Whether the public app URL is https (a named Mini App deep link needs it). */
  readonly appUrlHttps: boolean;
  readonly nowMs: number;
  resolveChatTelegramId(chatId: string): Promise<bigint | undefined>;
  resolveTenantSlug(tenantId: string): Promise<string | undefined>;
}

export interface TriviaAnnounceSummary {
  scanned: number;
  announced: number;
  initialized: number;
  skipped: number;
  errors: number;
}

const windowKeyFor = (cadence: TriviaCadence, nowMs: number): number =>
  cadence === "hourly"
    ? hourKeyFromMs(nowMs, ANNOUNCE_TZ_OFFSET_MIN)
    : dayKeyFromMs(nowMs, ANNOUNCE_TZ_OFFSET_MIN);

const readLastWindow = (raw: unknown): number | null => {
  if (raw && typeof raw === "object") {
    const value = (raw as Record<string, unknown>).lastWindow;
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
};

/**
 * games.trivia.announce — for every group that opted in (GamesConfig with
 * announce + community trivia on), posts a "new trivia" card with a button to
 * the Mini App the first time a fresh window opens. Idempotent per window via a
 * `{lastWindow}` marker in ChatSetting: the first sighting seeds the window
 * WITHOUT posting (so enabling it mid-window never spams), and thereafter it
 * announces exactly once when the window advances (hourly = on the dot).
 *
 * v1 scope: only the primary bot's tenant, because the group button is a named
 * Mini App deep link (`t.me/<bot>/<app>?startapp=game_dailytrivia_<gid>`) and
 * only the primary bot has a named app. Child-bot announcements are a follow-up.
 */
export const processTriviaAnnouncements = async (
  ctx: TriviaAnnounceContext,
): Promise<TriviaAnnounceSummary> => {
  const summary: TriviaAnnounceSummary = {
    scanned: 0,
    announced: 0,
    initialized: 0,
    skipped: 0,
    errors: 0,
  };
  if (!ctx.appUrlHttps) {
    return summary;
  }
  const primarySlug = `telegram-${ctx.primaryBotUsername
    .replace(/^@/u, "")
    .toLowerCase()}`;

  const entries = await ctx.chatSetting.listByKey(GAMES_CONFIG_KEY);
  for (const entry of entries) {
    summary.scanned += 1;
    const config = parseGamesConfig(entry.value);
    if (!config.announce || !config.games.dailytrivia) {
      summary.skipped += 1;
      continue;
    }
    const slug = await ctx.resolveTenantSlug(entry.tenantId);
    if (slug !== primarySlug) {
      summary.skipped += 1;
      continue;
    }

    const windowKey = windowKeyFor(config.triviaCadence, ctx.nowMs);
    const stateRaw = await ctx.chatSetting.getValue(
      entry.tenantId,
      entry.chatId,
      GAMES_ANNOUNCE_STATE_KEY,
    );
    const lastWindow = readLastWindow(stateRaw);
    if (lastWindow === null) {
      await ctx.chatSetting.setValue(
        entry.tenantId,
        entry.chatId,
        GAMES_ANNOUNCE_STATE_KEY,
        { lastWindow: windowKey },
      );
      summary.initialized += 1;
      continue;
    }
    if (windowKey <= lastWindow) {
      summary.skipped += 1;
      continue;
    }

    const telegramChatId = await ctx.resolveChatTelegramId(entry.chatId);
    if (telegramChatId === undefined) {
      summary.skipped += 1;
      continue;
    }

    try {
      const startParam = encodeGameStartParam(
        "dailytrivia",
        telegramChatId.toString(),
      );
      const url = `https://t.me/${ctx.primaryBotUsername}/${ctx.miniAppName}?startapp=${startParam}`;
      const reply: BotReply = {
        text: "🧠 *¡Nueva trivia!* Hay una pregunta nueva para el grupo. ¿Quién acierta primero?",
        parseMode: "Markdown",
        replyMarkup: { inline_keyboard: [[{ text: "🎮 Jugar trivia", url }]] },
      };
      const result = await ctx.gateway.sendMessage({
        chatId: telegramChatId,
        reply,
        token: ctx.token,
      });
      if (result.ok) {
        await ctx.chatSetting.setValue(
          entry.tenantId,
          entry.chatId,
          GAMES_ANNOUNCE_STATE_KEY,
          { lastWindow: windowKey },
        );
        summary.announced += 1;
      } else {
        summary.errors += 1;
      }
    } catch {
      summary.errors += 1;
    }
  }

  return summary;
};
