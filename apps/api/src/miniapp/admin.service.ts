import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  type PrismaClient,
  PrismaFoundationRepository,
  prisma,
} from "@superbot/data";
import { getRuntimeEnv } from "@superbot/shared";
import { HttpTelegramGateway } from "@superbot/telegram";

export interface ResolvedMiniappChat {
  readonly tenantId: string;
  readonly chatId: string;
  readonly telegramChatId: string;
  readonly title: string | undefined;
}

/**
 * The bot serving a Mini App request (resolved + HMAC-proven by InitDataGuard).
 * When omitted, calls fall back to the primary bot from the environment, so the
 * single-tenant path is unchanged.
 */
export interface MiniappBotScope {
  readonly username: string;
  readonly token: string;
}

const ADMIN_CACHE_TTL_MS = 300_000; // 5 min, mirrors the bot's cachedAdminIds
// Hard FIFO cap so the per-(bot,chat) admin cache can't grow without bound.
const MAX_ADMIN_CACHE_ENTRIES = 10_000;
// When a user isn't in the cached admin set we re-verify against Telegram (they
// may have just been promoted), but no more than once per group per this window
// so a genuine non-admin can't spam getChatAdministrators.
const ADMIN_REVERIFY_THROTTLE_MS = 15_000;
// The bot's own display name (for the Mini App header) changes rarely, so cache
// getMe generously per bot.
const BOT_NAME_TTL_MS = 3_600_000; // 1 h

/**
 * Authorization for Mini App writes. The live Telegram admin list is the ONLY
 * source of truth for mutations (fail-closed on any error); there is no admin
 * index. resolveChat maps a Telegram chat id to the internal chat within this
 * bot's tenant. The api never calls getUpdates — only stateless lookups.
 */
@Injectable()
export class MiniappAdminService {
  private readonly cache = new Map<
    string,
    { ids: Set<string>; expiresAt: number }
  >();
  private readonly reverifiedAt = new Map<string, number>();
  private readonly botNameCache = new Map<
    string,
    { name: string; expiresAt: number }
  >();
  private readonly gateway = new HttpTelegramGateway();
  private readonly foundation: PrismaFoundationRepository;

  constructor(private readonly client: PrismaClient = prisma) {
    this.foundation = new PrismaFoundationRepository(client);
  }

  private botKeyOf(bot?: MiniappBotScope): string {
    const username = bot?.username ?? getRuntimeEnv().TELEGRAM_BOT_USERNAME;
    return username.replace(/^@/u, "").toLowerCase();
  }

  private tokenOf(bot?: MiniappBotScope): string | undefined {
    return bot?.token ?? getRuntimeEnv().TELEGRAM_BOT_TOKEN;
  }

  /**
   * The bot's own Telegram user id, taken from the "<bot_id>:<auth>" token
   * prefix — no network call. Returns null when the token is missing or malformed.
   */
  private botUserIdFromToken(bot?: MiniappBotScope): bigint | null {
    const prefix = this.tokenOf(bot)?.split(":")[0];
    if (prefix === undefined || !/^\d+$/u.test(prefix)) {
      return null;
    }
    return BigInt(prefix);
  }

  /**
   * Whether the serving bot itself is an administrator in the group. The Mini App
   * uses this to steer onboarding: moderation-oriented purposes (moderate / both)
   * need admin rights, so when the bot is only a member we disable them and say
   * why. Advisory ONLY — unlike assertGroupAdmin this fails OPEN: on any
   * uncertainty it assumes admin so a transient lookup hiccup never blocks a
   * legitimate setup (real mutations are still gated fail-closed elsewhere).
   */
  async isBotAdmin(
    telegramChatId: string,
    bot?: MiniappBotScope,
  ): Promise<boolean> {
    const botId = this.botUserIdFromToken(bot);
    if (botId === null) {
      return true;
    }
    try {
      const member = await this.gateway.getChatMember({
        chatId: BigInt(telegramChatId),
        userId: botId,
        token: this.tokenOf(bot),
      });
      if (!member.ok || member.status === undefined) {
        return true;
      }
      return member.status === "administrator" || member.status === "creator";
    } catch {
      return true;
    }
  }

  /**
   * The serving bot's own display name (getMe.first_name), cached per bot. Used
   * to brand the Mini App header with the bot instead of the group. Best-effort:
   * returns a stale cached value or null on failure (never throws).
   */
  async botDisplayName(bot?: MiniappBotScope): Promise<string | null> {
    const key = this.botKeyOf(bot);
    const now = Date.now();
    const cached = this.botNameCache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.name;
    }
    try {
      const me = await this.gateway.getMe({ token: this.tokenOf(bot) });
      if (me.ok && me.name) {
        this.botNameCache.set(key, {
          name: me.name,
          expiresAt: now + BOT_NAME_TTL_MS,
        });
        return me.name;
      }
    } catch {
      // fall through to stale cache / null
    }
    return cached?.name ?? null;
  }

  /**
   * The serving bot's onboarding identity: its `template` (community/creator/
   * support/business/custom, or null for the primary bot) and whether it is the
   * primary bot. The Mini App uses this to adapt the "what will you use this bot
   * for?" question — a child `support` bot leans to moderation, a `creator` bot
   * to games — and to brand with the right name. Best-effort: unknown → primary
   * assumption falls through to null template.
   */
  async botIdentity(
    bot?: MiniappBotScope,
  ): Promise<{ template: string | null; isPrimary: boolean }> {
    const username = this.botKeyOf(bot);
    const primary = getRuntimeEnv()
      .TELEGRAM_BOT_USERNAME.replace(/^@/u, "")
      .toLowerCase();
    if (username === primary) {
      return { template: null, isPrimary: true };
    }
    const row = await this.client.managedBot.findUnique({
      where: { username },
    });
    if (!row || row.isPrimary) {
      return { template: null, isPrimary: Boolean(row?.isPrimary) };
    }
    return { template: row.template, isPrimary: false };
  }

  private async resolveTenantId(bot?: MiniappBotScope): Promise<string | null> {
    const tenant = await this.client.tenant.findUnique({
      where: { slug: `telegram-${this.botKeyOf(bot)}` },
    });
    return tenant?.id ?? null;
  }

  async resolveChat(
    telegramChatId: string,
    bot?: MiniappBotScope,
  ): Promise<ResolvedMiniappChat> {
    const tenantId = await this.resolveTenantId(bot);
    if (!tenantId) {
      throw new NotFoundException({ error: "chat-not-found" });
    }
    const chat = await this.foundation.findChatByTelegramId(
      tenantId,
      BigInt(telegramChatId),
    );
    if (!chat) {
      throw new NotFoundException({ error: "chat-not-found" });
    }
    return { tenantId, chatId: chat.chatId, telegramChatId, title: chat.title };
  }

  async assertGroupAdmin(
    telegramChatId: string,
    userId: string,
    bot?: MiniappBotScope,
  ): Promise<void> {
    const env = getRuntimeEnv();
    if (
      env.SUPERBOT_OWNER_TELEGRAM_ID != null &&
      env.SUPERBOT_OWNER_TELEGRAM_ID.toString() === userId
    ) {
      return;
    }
    const chatId = BigInt(telegramChatId);
    let admins = await this.cachedAdminIds(chatId, bot);
    if (!admins.has(userId)) {
      // The cached list may be stale (the user was just promoted). Re-verify
      // against Telegram once — throttled per group so a non-admin can't spam.
      const key = `${this.botKeyOf(bot)}:${telegramChatId}`;
      const lastReverify = this.reverifiedAt.get(key) ?? 0;
      if (Date.now() - lastReverify > ADMIN_REVERIFY_THROTTLE_MS) {
        this.reverifiedAt.set(key, Date.now());
        admins = await this.cachedAdminIds(chatId, bot, true);
      }
      if (!admins.has(userId)) {
        throw new ForbiddenException({ error: "not-admin" });
      }
    }
  }

  private async cachedAdminIds(
    chatId: bigint,
    bot?: MiniappBotScope,
    forceRefresh = false,
  ): Promise<Set<string>> {
    // Key by bot too: the same Telegram chat could, in principle, be served by
    // different bots across tenants, and each sees its own admin list.
    const key = `${this.botKeyOf(bot)}:${chatId.toString()}`;
    const now = Date.now();
    const cached = this.cache.get(key);
    if (!forceRefresh && cached && cached.expiresAt > now) {
      return cached.ids;
    }
    if (cached) {
      this.cache.delete(key);
    }

    try {
      const result = await this.gateway.getChatAdministrators({
        chatId,
        token: this.tokenOf(bot),
      });
      if (!result.ok || !result.admins || result.admins.length === 0) {
        throw new Error("no-admins");
      }
      const ids = new Set(
        result.admins.map((admin) => admin.userId.toString()),
      );
      if (this.cache.size >= MAX_ADMIN_CACHE_ENTRIES) {
        const oldest = this.cache.keys().next().value;
        if (oldest !== undefined) {
          this.cache.delete(oldest);
        }
      }
      this.cache.set(key, { ids, expiresAt: now + ADMIN_CACHE_TTL_MS });
      return ids;
    } catch {
      // Fail closed: never authorize a write when Telegram can't confirm.
      throw new ForbiddenException({ error: "not-admin" });
    }
  }
}
