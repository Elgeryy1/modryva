import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  type AiAccessRepository,
  type EntitlementRecord,
  generateWebhookSecret,
  hashWebhookSecret,
  type ManagedBotChatRecord,
  type ManagedBotRecord,
  type ManagedBotTemplateName,
  type PlatformRepository,
  type PlatformRoleName,
  PrismaAiAccessRepository,
  PrismaFoundationRepository,
  PrismaPlatformRepository,
} from "@superbot/data";
import { getRuntimeEnv, TELEGRAM_ALLOWED_UPDATES } from "@superbot/shared";
import { HttpTelegramGateway, type TelegramChatInfo } from "@superbot/telegram";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "./miniapp/init-data.guard.js";

const templates = new Set([
  "community",
  "creator",
  "support",
  "business",
  "custom",
]);
const roles = new Set([
  "platform_owner",
  "promo_admin",
  "bot_factory_admin",
  "support_admin",
  "auditor",
]);
const BOT_USERNAME_RE = /^[a-z0-9_]{4,64}$/u;
const configuredPlatformAdminRoles: readonly PlatformRoleName[] = [
  "promo_admin",
  "bot_factory_admin",
  "auditor",
];

const parseTelegramUserId = (value: unknown): bigint => {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return BigInt(value);
  }
  if (typeof value === "string" && /^\d+$/u.test(value)) {
    return BigInt(value);
  }
  throw new BadRequestException({ error: "invalid-telegram-user-id" });
};

const parseTelegramChatId = (value: unknown): bigint => {
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return BigInt(value);
  }
  if (typeof value === "string" && /^-?\d+$/u.test(value)) {
    return BigInt(value);
  }
  throw new BadRequestException({ error: "invalid-telegram-chat-id" });
};

const parseMessageText = (value: unknown): string => {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > 4096) {
    throw new BadRequestException({ error: "invalid-message-text" });
  }
  return text;
};

const parseBotUsername = (value: string): string => {
  const username = value.replace(/^@/u, "").toLowerCase();
  if (!BOT_USERNAME_RE.test(username)) {
    throw new BadRequestException({ error: "invalid-bot" });
  }
  return username;
};

const parseTemplate = (value: unknown): ManagedBotTemplateName => {
  const template =
    typeof value === "string" ? value.toLowerCase() : "community";
  if (!templates.has(template)) {
    throw new BadRequestException({ error: "invalid-template" });
  }
  return template as ManagedBotTemplateName;
};

const parseRole = (value: unknown): PlatformRoleName => {
  const role = typeof value === "string" ? value.toLowerCase() : "";
  if (!roles.has(role)) {
    throw new BadRequestException({ error: "invalid-role" });
  }
  return role as PlatformRoleName;
};

const expiresAtFromDays = (value: unknown): Date | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const days =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/u.test(value)
        ? Number.parseInt(value, 10)
        : NaN;
  if (!Number.isSafeInteger(days) || days <= 0 || days > 3650) {
    throw new BadRequestException({ error: "invalid-expiry-days" });
  }
  return new Date(Date.now() + days * 86_400_000);
};

const serializeDate = (value: Date | null | undefined): string | null =>
  value ? value.toISOString() : null;

const serializeEntitlement = (entitlement: EntitlementRecord) => ({
  ...entitlement,
  ownerTelegramId: entitlement.ownerTelegramId.toString(),
  expiresAt: serializeDate(entitlement.expiresAt),
  revokedAt: serializeDate(entitlement.revokedAt),
});

const serializeManagedBot = (bot: ManagedBotRecord) => ({
  ...bot,
  telegramBotId: bot.telegramBotId?.toString() ?? null,
  ownerTelegramId: bot.ownerTelegramId?.toString() ?? null,
});

const serializeManagedBotChat = (chat: ManagedBotChatRecord) => ({
  ...chat,
  telegramChatId: chat.telegramChatId.toString(),
  updatedAt: chat.updatedAt.toISOString(),
});

type PlatformTelegramGateway = Pick<
  HttpTelegramGateway,
  "setWebhook" | "sendMessage" | "getChat" | "getWebhookInfo"
>;

const hasMissingChatTitle = (chat: ManagedBotChatRecord): boolean => {
  const title = chat.title?.trim();
  return !title || title === chat.telegramChatId.toString();
};

const telegramChatDisplayName = (
  chat: TelegramChatInfo | undefined,
): string | undefined => {
  const title = chat?.title?.trim();
  if (title) {
    return title;
  }
  const fullName = [chat?.firstName, chat?.lastName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
  if (fullName) {
    return fullName;
  }
  const username = chat?.username?.trim();
  return username ? `@${username}` : undefined;
};

@Controller("v1/platform")
@UseGuards(InitDataGuard)
export class PlatformController {
  private readonly platform: PlatformRepository;
  private readonly gateway: PlatformTelegramGateway;
  private readonly foundation = new PrismaFoundationRepository();
  private readonly aiAccess: AiAccessRepository;

  constructor(
    platform?: PlatformRepository,
    gateway?: PlatformTelegramGateway,
    aiAccess?: AiAccessRepository,
  ) {
    const env = getRuntimeEnv();
    this.platform =
      platform ??
      new PrismaPlatformRepository(undefined, env.MANAGED_BOT_TOKEN_KEY);
    this.gateway = gateway ?? new HttpTelegramGateway();
    this.aiAccess = aiAccess ?? new PrismaAiAccessRepository();
  }

  @Post("mybots/reactivate")
  async reactivateBot(
    @Req() req: MiniappRequest,
    @Body() body: { username?: string },
  ) {
    const ctx = getMiniappContext(req);
    const ownerId = BigInt(ctx.userId);
    const username = String(body?.username ?? "")
      .replace(/^@/u, "")
      .toLowerCase();
    if (!username) {
      throw new BadRequestException({ error: "invalid-username" });
    }
    const info = await this.platform.reactivationInfo(username, ownerId);
    if (!info.ok) {
      return { ok: false, reason: info.reason };
    }
    const env = getRuntimeEnv();
    const base = (
      env.TELEGRAM_WEBHOOK_BASE_URL ||
      env.TELEGRAM_APP_URL ||
      ""
    ).replace(/\/$/u, "");
    if (!base.startsWith("https://")) {
      return { ok: false, reason: "webhook-url-not-https" };
    }
    const secret = generateWebhookSecret();
    const result = await this.gateway.setWebhook({
      token: info.token,
      url: `${base}/telegram/webhook/${username}`,
      secretToken: secret,
      allowedUpdates: TELEGRAM_ALLOWED_UPDATES,
    });
    if (!result.ok) {
      return { ok: false, reason: "webhook-failed" };
    }
    const committed = await this.platform.commitReactivation({
      username,
      ownerTelegramId: ownerId,
      secretHash: hashWebhookSecret(secret),
      entitlementId: info.entitlementId,
      consumesSlot: info.consumesSlot,
    });
    return committed ? { ok: true } : { ok: false, reason: "commit-failed" };
  }

  /**
   * Owner-only, idempotent refresh of EVERY active managed bot's webhook so they
   * pick up the current allowed_updates (message_reaction included) without
   * waiting for a reactivation. Safe to run repeatedly: each run rotates the
   * webhook secret (we only store its hash, so the plaintext can't be reused)
   * and re-registers with drop_pending_updates=false — queued updates are never
   * dropped. Each bot is then verified via getWebhookInfo. Never logs tokens.
   */
  @Post("webhooks/refresh")
  async refreshWebhooks(@Req() req: MiniappRequest) {
    await this.requireOwner(req);
    const env = getRuntimeEnv();
    const base = (
      env.TELEGRAM_WEBHOOK_BASE_URL ||
      env.TELEGRAM_APP_URL ||
      ""
    ).replace(/\/$/u, "");
    if (!base.startsWith("https://")) {
      return { ok: false, reason: "webhook-url-not-https" };
    }
    const active = (await this.platform.listAllManagedBots()).filter(
      (bot) => bot.status === "active",
    );
    const results: Array<{
      username: string;
      status: "verified" | "skipped" | "failed";
      reason?: string;
    }> = [];
    for (const bot of active) {
      results.push({
        username: bot.username,
        ...(await this.refreshOneWebhook(bot.username, base)),
      });
    }
    const verified = results.filter((r) => r.status === "verified").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const failures = results
      .filter((r) => r.status === "failed")
      .map((r) => ({ username: r.username, reason: r.reason ?? "unknown" }));
    await this.foundation.recordAudit({
      tenantId: undefined,
      actorType: "user",
      action: "platform.webhooks.refreshed",
      resourceType: "managed_bot",
      payload: {
        total: active.length,
        verified,
        skipped,
        failed: failures.length,
      },
    });
    return { ok: true, total: active.length, verified, skipped, failures };
  }

  private async refreshOneWebhook(
    username: string,
    base: string,
  ): Promise<{ status: "verified" | "skipped" | "failed"; reason?: string }> {
    // The primary bot (poller-driven) and any bot we can't decrypt a token for
    // return undefined here — skip them rather than count them as failures.
    const token = await this.platform.getManagedBotToken(username);
    if (!token) {
      return { status: "skipped", reason: "no-token" };
    }
    const secret = generateWebhookSecret();
    try {
      const set = await this.gateway.setWebhook({
        token,
        url: `${base}/telegram/webhook/${username}`,
        secretToken: secret,
        allowedUpdates: TELEGRAM_ALLOWED_UPDATES,
        // Never discard updates already queued for an existing, working bot.
        dropPendingUpdates: false,
      });
      if (!set.ok) {
        return { status: "failed", reason: set.reason ?? "webhook-failed" };
      }
      // Persist the rotated secret right after setWebhook so an incoming update
      // carrying the new secret validates against the stored hash.
      await this.platform.updateManagedBotWebhookSecret({
        username,
        webhookSecretHash: hashWebhookSecret(secret),
      });
      const info = await this.gateway.getWebhookInfo({ token });
      const verified =
        info.ok && (info.allowedUpdates?.includes("message_reaction") ?? false);
      return verified
        ? { status: "verified" }
        : { status: "failed", reason: "verify-missing-message_reaction" };
    } catch {
      return { status: "failed", reason: "webhook-error" };
    }
  }

  @Get("me")
  async me(@Req() req: MiniappRequest) {
    const ctx = getMiniappContext(req);
    const userId = BigInt(ctx.userId);
    const owner = await this.isOwner(userId);
    const [roles, entitlements, slots, bots] = await Promise.all([
      this.effectiveRoles(userId),
      this.platform.listEntitlements(userId),
      this.platform.availableManagedBotSlots(userId),
      owner
        ? this.platform.listAllManagedBots()
        : this.platform.listManagedBots(userId),
    ]);
    const env = getRuntimeEnv();
    const primaryUsername = this.primaryUsername();
    return {
      userId: ctx.userId,
      isOwner: owner,
      roles,
      entitlements: entitlements.map(serializeEntitlement),
      managedBotSlots: slots,
      botScope: owner ? "all" : "owned",
      primaryBot: owner
        ? {
            username: primaryUsername,
            displayName: `@${primaryUsername}`,
            status: env.TELEGRAM_BOT_TOKEN ? "active" : "missing-token",
          }
        : null,
      bots: bots.map(serializeManagedBot),
    };
  }

  @Get("bots/:username")
  async botDetails(
    @Req() req: MiniappRequest,
    @Param("username") username: string,
  ) {
    const bot = await this.requireBotReadAccess(req, username);
    const chats = await this.platform.listManagedBotChats(bot.username);
    const enrichedChats = await this.enrichManagedBotChats(bot, chats);
    return {
      bot: serializeManagedBot(bot),
      chats: enrichedChats.map(serializeManagedBotChat),
    };
  }

  @Post("bots/:username/send-message")
  async sendMessageAsBot(
    @Req() req: MiniappRequest,
    @Param("username") username: string,
    @Body() body: Record<string, unknown>,
  ) {
    const actor = await this.requireOwner(req);
    const botUsername = parseBotUsername(username);
    const chatId = parseTelegramChatId(body.chatId);
    const text = parseMessageText(body.text);
    const parseMode =
      body.parseMode === "HTML" ||
      body.parseMode === "Markdown" ||
      body.parseMode === "MarkdownV2"
        ? body.parseMode
        : undefined;
    const token = await this.tokenForSending(botUsername);
    if (!token) {
      throw new BadRequestException({ error: "bot-token-unavailable" });
    }
    try {
      await this.gateway.sendMessage({
        chatId,
        token,
        reply: {
          text,
          ...(parseMode ? { parseMode } : {}),
          disableWebPagePreview: true,
        },
      });
    } catch {
      throw new BadRequestException({ error: "telegram-send-failed" });
    }

    const bot = await this.platform.findManagedBot(botUsername);
    await this.foundation.recordAudit({
      tenantId: bot?.tenantId,
      actorType: "user",
      actorId: actor.toString(),
      action: "platform.send_message_as_bot",
      resourceType: "telegram_chat",
      resourceId: chatId.toString(),
      payload: { botUsername, telegramChatId: chatId.toString() },
    });
    return { ok: true };
  }

  @Get("promos")
  async promos(@Req() req: MiniappRequest) {
    await this.requireAccess(req, ["promo_admin", "auditor"]);
    return { promos: await this.platform.listPromos(100) };
  }

  @Post("promos")
  async createPromo(
    @Req() req: MiniappRequest,
    @Body() body: Record<string, unknown>,
  ) {
    const actor = await this.requireAccess(req, ["promo_admin"]);
    const maxUses = Number.parseInt(String(body.maxUses ?? "1"), 10);
    if (!Number.isSafeInteger(maxUses) || maxUses <= 0 || maxUses > 10_000) {
      throw new BadRequestException({ error: "invalid-max-uses" });
    }
    const promo = await this.platform.createPromo({
      tenantId: undefined,
      template: parseTemplate(body.template),
      maxUses,
      expiresAt: expiresAtFromDays(body.expiresInDays),
      note: typeof body.note === "string" ? body.note.slice(0, 500) : undefined,
      createdByTelegramId: actor,
    });
    return { promo };
  }

  @Post("promos/:id/revoke")
  async revokePromo(@Req() req: MiniappRequest, @Param("id") id: string) {
    await this.requireAccess(req, ["promo_admin"]);
    return { revoked: await this.platform.revokePromo(id) };
  }

  @Post("grants/custombot")
  async grantCustomBot(
    @Req() req: MiniappRequest,
    @Body() body: Record<string, unknown>,
  ) {
    const actor = await this.requireAccess(req, ["bot_factory_admin"]);
    const entitlement = await this.platform.grantManagedBotSlot({
      ownerTelegramId: parseTelegramUserId(body.telegramUserId),
      template: parseTemplate(body.template),
      expiresAt: expiresAtFromDays(body.expiresInDays),
      createdByTelegramId: actor,
    });
    return { entitlement: serializeEntitlement(entitlement) };
  }

  @Get("ai-codes")
  async listAiCodes(@Req() req: MiniappRequest) {
    await this.requireOwner(req);
    const codes = await this.aiAccess.listCodes(100);
    return {
      codes: codes.map((code) => ({
        codePrefix: code.codePrefix,
        days: code.days,
        note: code.note ?? null,
        createdByTelegramId: code.createdByTelegramId.toString(),
        redeemedByChatId: code.redeemedByChatId?.toString() ?? null,
        redeemedAt: serializeDate(code.redeemedAt),
        createdAt: code.createdAt.toISOString(),
      })),
    };
  }

  @Post("ai-codes")
  async createAiCode(
    @Req() req: MiniappRequest,
    @Body() body: Record<string, unknown>,
  ) {
    const actor = await this.requireOwner(req);
    const days = Number.parseInt(String(body.days ?? "30"), 10);
    if (!Number.isSafeInteger(days) || days <= 0 || days > 3650) {
      throw new BadRequestException({ error: "invalid-days" });
    }
    const note =
      typeof body.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, 200)
        : undefined;
    const code = await this.aiAccess.generateCode(actor, days, note);
    return { code, days };
  }

  @Post("roles")
  async updateRole(
    @Req() req: MiniappRequest,
    @Body() body: Record<string, unknown>,
  ) {
    const actor = await this.requireOwner(req);
    const telegramUserId = parseTelegramUserId(body.telegramUserId);
    const role = parseRole(body.role);
    const action = body.action;
    if (action === "grant") {
      await this.platform.grantRole({
        telegramUserId,
        role,
        grantedByTelegramId: actor,
      });
      return { ok: true };
    }
    if (action === "revoke") {
      await this.platform.revokeRole({ telegramUserId, role });
      return { ok: true };
    }
    throw new BadRequestException({ error: "invalid-action" });
  }

  private async requireAccess(
    req: MiniappRequest,
    allowed: readonly PlatformRoleName[],
  ): Promise<bigint> {
    const ctx = getMiniappContext(req);
    const userId = BigInt(ctx.userId);
    if (await this.isOwner(userId)) {
      return userId;
    }
    const effectiveRoles = await this.effectiveRoles(userId);
    for (const role of allowed) {
      if (effectiveRoles.includes(role)) {
        return userId;
      }
    }
    throw new ForbiddenException({ error: "platform-access-denied" });
  }

  private async requireOwner(req: MiniappRequest): Promise<bigint> {
    const ctx = getMiniappContext(req);
    const userId = BigInt(ctx.userId);
    if (!(await this.isOwner(userId))) {
      throw new ForbiddenException({ error: "platform-owner-required" });
    }
    return userId;
  }

  private async requireBotReadAccess(
    req: MiniappRequest,
    rawUsername: string,
  ): Promise<ManagedBotRecord> {
    const ctx = getMiniappContext(req);
    const userId = BigInt(ctx.userId);
    const username = parseBotUsername(rawUsername);
    const bot = await this.platform.findManagedBot(username);
    if (!bot) {
      throw new BadRequestException({ error: "bot-not-found" });
    }
    if ((await this.isOwner(userId)) || bot.ownerTelegramId === userId) {
      return bot;
    }
    throw new ForbiddenException({ error: "bot-access-denied" });
  }

  private async tokenForSending(username: string): Promise<string | undefined> {
    if (username === this.primaryUsername()) {
      return getRuntimeEnv().TELEGRAM_BOT_TOKEN;
    }
    const bot = await this.platform.findManagedBot(username);
    if (!bot) {
      throw new BadRequestException({ error: "bot-not-found" });
    }
    if (bot.status !== "active") {
      throw new BadRequestException({ error: "bot-not-active" });
    }
    return this.platform.getManagedBotToken(username);
  }

  private async enrichManagedBotChats(
    bot: ManagedBotRecord,
    chats: ManagedBotChatRecord[],
  ): Promise<ManagedBotChatRecord[]> {
    if (bot.status !== "active" || !chats.some(hasMissingChatTitle)) {
      return chats;
    }

    let token: string | undefined;
    try {
      token = await this.platform.getManagedBotToken(bot.username);
    } catch {
      return chats;
    }
    if (!token) {
      return chats;
    }

    const enriched: ManagedBotChatRecord[] = [];
    for (const chat of chats) {
      enriched.push(await this.enrichManagedBotChat(bot, chat, token));
    }
    return enriched;
  }

  private async enrichManagedBotChat(
    bot: ManagedBotRecord,
    chat: ManagedBotChatRecord,
    token: string,
  ): Promise<ManagedBotChatRecord> {
    if (!hasMissingChatTitle(chat)) {
      return chat;
    }

    try {
      const result = await this.gateway.getChat({
        chatId: chat.telegramChatId,
        token,
      });
      const telegramChat = result.chat;
      const displayName = telegramChatDisplayName(telegramChat);
      if (!result.ok || !telegramChat || !displayName) {
        return chat;
      }

      const type = telegramChat.type?.trim();
      const chatUsername = telegramChat.username?.trim();
      const enriched: ManagedBotChatRecord = {
        ...chat,
        title: displayName,
        type: type || chat.type,
        username: chatUsername || chat.username,
      };
      try {
        await this.platform.updateManagedBotChatMetadata({
          botUsername: bot.username,
          telegramChatId: chat.telegramChatId,
          title: displayName,
          type,
          chatUsername,
        });
      } catch {
        // The panel can still show the live Telegram title even if caching fails.
      }
      return enriched;
    } catch {
      return chat;
    }
  }

  private primaryUsername(): string {
    return getRuntimeEnv()
      .TELEGRAM_BOT_USERNAME.replace(/^@/u, "")
      .toLowerCase();
  }

  private async isOwner(userId: bigint): Promise<boolean> {
    const env = getRuntimeEnv();
    return (
      env.SUPERBOT_OWNER_TELEGRAM_ID === userId ||
      (await this.platform.hasRole(userId, "platform_owner"))
    );
  }

  private async effectiveRoles(userId: bigint): Promise<PlatformRoleName[]> {
    const roles = new Set(
      (await this.platform.listRoles(userId)).map((role) => role.role),
    );
    if (this.isConfiguredPlatformAdmin(userId)) {
      for (const role of configuredPlatformAdminRoles) {
        roles.add(role);
      }
    }
    return [...roles];
  }

  private isConfiguredPlatformAdmin(userId: bigint): boolean {
    const env = getRuntimeEnv();
    return env.SUPERBOT_PLATFORM_ADMIN_TELEGRAM_IDS.some(
      (adminId) => adminId === userId,
    );
  }
}
