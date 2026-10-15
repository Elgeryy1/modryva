import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  PrismaBotGrantedAdminRepository,
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
// Upper bound on groups scanned for the cross-group roster. Each one may cost a
// getChatAdministrators call, so an unbounded scan is both slow and a fast way
// to hit Telegram's rate limit. Well above any realistic tenant; exceeding it
// logs rather than silently truncating.
const MAX_ADMIN_SCAN_CHATS = 200;
const ADMIN_SCAN_CONCURRENCY = 5;

/**
 * A chat id straight off the URL. `BigInt()` throws a raw SyntaxError on
 * anything non-numeric, which Nest turns into a 500 — so a malformed id read as
 * a server fault instead of a bad request, and the caller got no idea what was
 * wrong. Every Mini App route funnels through assertGroupAdmin/resolveChat, so
 * validating here covers all of them.
 */
const parseTelegramChatId = (value: string): bigint => {
  if (!/^-?\d+$/u.test(value)) {
    throw new BadRequestException({ error: "invalid-group-id" });
  }
  return BigInt(value);
};

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
  private readonly appointed: PrismaBotGrantedAdminRepository;

  constructor(private readonly client: PrismaClient = prisma) {
    this.foundation = new PrismaFoundationRepository(client);
    this.appointed = new PrismaBotGrantedAdminRepository(client);
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
      parseTelegramChatId(telegramChatId),
    );
    if (!chat) {
      throw new NotFoundException({ error: "chat-not-found" });
    }
    return { tenantId, chatId: chat.chatId, telegramChatId, title: chat.title };
  }

  /**
   * Whether this is the platform owner (SUPERBOT_OWNER_TELEGRAM_ID). The one
   * caller allowed to see data that belongs to no group — private-chat Mini App
   * opens — because those cannot be attributed to a community, so there is no
   * group-admin claim that could ever justify them. Unset env = nobody.
   */
  isPlatformOwner(userId: string): boolean {
    const owner = getRuntimeEnv().SUPERBOT_OWNER_TELEGRAM_ID;
    return owner != null && owner.toString() === userId;
  }

  /**
   * Every group this person administers under the serving bot. The cross-group
   * roster is built from exactly this list, so this method IS the tenant
   * boundary for it: whatever it returns, that admin gets to see the IPs of.
   *
   * Fail-closed PER CHAT rather than for the whole call: a group whose admin
   * list Telegram won't confirm right now is dropped, not assumed. That makes a
   * transient failure under-report (a group missing from the view) instead of
   * over-report (someone else's members in front of these eyes).
   *
   * The platform owner skips the per-chat checks — they already bypass
   * assertGroupAdmin, so making them wait on N Telegram calls to reach the same
   * answer would only add latency and rate-limit exposure.
   */
  async listAdminChats(
    userId: string,
    bot?: MiniappBotScope,
  ): Promise<ResolvedMiniappChat[]> {
    const tenantId = await this.resolveTenantId(bot);
    if (!tenantId) {
      return [];
    }
    const rows = await this.client.chat.findMany({
      // Private chats hold no roster and have no admin list to check; asking
      // Telegram about them would burn a call per DM the bot has ever received.
      where: { tenantId, type: { in: ["group", "supergroup"] } },
      orderBy: { updatedAt: "desc" },
      take: MAX_ADMIN_SCAN_CHATS + 1,
    });
    if (rows.length > MAX_ADMIN_SCAN_CHATS) {
      // Not silent: an operator seeing a partial view deserves to know why.
      console.warn(
        `[roster] tenant ${tenantId} has more than ${MAX_ADMIN_SCAN_CHATS} groups; only the ${MAX_ADMIN_SCAN_CHATS} most recently active are scanned`,
      );
    }
    const chats = rows.slice(0, MAX_ADMIN_SCAN_CHATS).map((chat) => ({
      tenantId,
      chatId: chat.id,
      telegramChatId: chat.telegramChatId.toString(),
      title: chat.title ?? undefined,
    }));

    if (this.isPlatformOwner(userId)) {
      return chats;
    }

    // Small batches: getChatAdministrators is one call per group and Telegram
    // rate-limits per bot, so firing all of them at once is how you earn a 429.
    const allowed: ResolvedMiniappChat[] = [];
    for (let i = 0; i < chats.length; i += ADMIN_SCAN_CONCURRENCY) {
      const batch = chats.slice(i, i + ADMIN_SCAN_CONCURRENCY);
      const verdicts = await Promise.all(
        batch.map(async (chat) => {
          try {
            const admins = await this.cachedAdminIds(
              BigInt(chat.telegramChatId),
              bot,
            );
            return admins.has(userId);
          } catch {
            return false;
          }
        }),
      );
      batch.forEach((chat, index) => {
        if (verdicts[index]) {
          allowed.push(chat);
        }
      });
    }
    return allowed;
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
    const chatId = parseTelegramChatId(telegramChatId);
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

  /**
   * Stronger than the normal Mini App read gate: mutations that change group
   * membership must always re-read Telegram's current admin list. In
   * particular, the platform owner shortcut is deliberately not accepted here
   * because it is not proof that the actor currently administers this chat.
   */
  async assertGroupAdminForMutation(
    telegramChatId: string,
    userId: string,
    bot?: MiniappBotScope,
  ): Promise<void> {
    const admins = await this.cachedAdminIds(BigInt(telegramChatId), bot, true);
    if (!admins.has(userId)) {
      throw new ForbiddenException({ error: "not-admin" });
    }
  }

  /**
   * Who may change the bot's configuration: administrators promoted BY HAND in
   * Telegram, never the ones the bot appointed through /admin.
   *
   * This closes a privilege escalation in the appointed-admin guard itself. An
   * appointed admin could otherwise open the settings and switch off the very
   * guard that watches them — or raise its thresholds until it never fires.
   * Handing someone moderation powers is not the same as handing them the
   * controls of the thing that polices those powers.
   *
   * The platform owner always passes: they are the one who cannot be locked out.
   */
  async assertCanChangeSettings(
    telegramChatId: string,
    userId: string,
    bot?: MiniappBotScope,
  ): Promise<void> {
    await this.assertGroupAdmin(telegramChatId, userId, bot);
    if (this.isPlatformOwner(userId)) {
      return;
    }
    let appointed: unknown = null;
    try {
      appointed = await this.appointed.findActiveByTelegramChat(
        parseTelegramChatId(telegramChatId),
        BigInt(userId),
      );
    } catch {
      // Fail OPEN on a lookup error, unlike the admin check above. Being unable
      // to read our own ledger says nothing about this person, and locking
      // every admin out of the settings because the database hiccuped is a
      // worse failure than briefly letting an appointed admin in — they still
      // had to pass the Telegram admin check to get here.
      return;
    }
    if (appointed) {
      throw new ForbiddenException({
        error: "appointed-admin-cannot-configure",
      });
    }
  }

  /**
   * Fail-closed preflight for one explicit member-removal request. This is
   * intentionally per target; it is not a list or batch moderation primitive.
   */
  async assertMemberCanBeKicked(input: {
    readonly telegramChatId: string;
    readonly actorTelegramUserId: string;
    readonly targetTelegramUserId: bigint;
    readonly bot?: MiniappBotScope;
  }): Promise<void> {
    const targetId = input.targetTelegramUserId.toString();
    if (targetId === input.actorTelegramUserId) {
      throw new ForbiddenException({ error: "cannot-remove-self" });
    }

    const chatId = BigInt(input.telegramChatId);
    // Refresh rather than use the 5-minute read cache: an admin must never be
    // removable just because their promotion raced with an open Mini App.
    const admins = await this.cachedAdminIds(chatId, input.bot, true);
    if (admins.has(targetId)) {
      throw new ForbiddenException({ error: "cannot-remove-admin" });
    }

    const member = await this.gateway.getChatMember({
      chatId,
      userId: input.targetTelegramUserId,
      token: this.tokenOf(input.bot),
    });
    if (
      !member.ok ||
      (member.status !== "member" && member.status !== "restricted")
    ) {
      throw new NotFoundException({ error: "target-not-member" });
    }
  }

  /**
   * Remove exactly one already-authorized member while allowing them to rejoin.
   * Telegram expresses a kick as a short ban followed by an immediate unban.
   * The finite fallback ban ensures an unlikely failed unban cannot turn into a
   * permanent ban; callers already preflight and audit one named target only.
   */
  async kickMember(input: {
    readonly telegramChatId: string;
    readonly targetTelegramUserId: bigint;
    readonly bot?: MiniappBotScope;
  }): Promise<void> {
    const chatId = BigInt(input.telegramChatId);
    const token = this.tokenOf(input.bot);
    const ban = await this.gateway.banChatMember({
      chatId,
      userId: input.targetTelegramUserId,
      token,
      // Telegram treats bans shorter than 30 seconds as permanent. This makes
      // the fallback finite if a network interruption prevents the unban.
      untilDate: new Date(Date.now() + 120_000),
    });
    if (!ban.ok || ban.skipped) {
      throw new Error("kick-ban-failed");
    }

    const unban = await this.gateway.unbanChatMember({
      chatId,
      userId: input.targetTelegramUserId,
      token,
      // A just-issued ban can take a moment to become visible to Telegram.
      // false is required so that a kick never accidentally remains a ban.
      onlyIfBanned: false,
    });
    if (!unban.ok || unban.skipped) {
      throw new Error("kick-unban-failed");
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
