import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  PrismaAntifloodRepository,
  PrismaAntiraidRepository,
  PrismaCaptchaRepository,
  PrismaChatSettingRepository,
  PrismaContentLockRepository,
  PrismaFoundationRepository,
  PrismaGroupProtectionRepository,
  PrismaModerationExtraRepository,
  PrismaWelcomeRepository,
} from "@superbot/data";
import {
  parseReactionModerationConfig,
  REACTION_MODERATION_SETTING_KEY,
} from "@superbot/module-security";
import {
  CHAT_QUIET_KEY,
  chatQuietSchema,
  decodeStartParam,
  GAMES_CONFIG_KEY,
  gamesConfigSchema,
  isSectionName,
  parseGamesConfig,
  RITUALS_KEY,
  ritualsSchema,
  SCHEDULE_RULES_KEY,
  SECTION_NAMES,
  SECTION_SCHEMAS,
  type SectionName,
  scheduleRulesSchema,
  WEEKLY_RECAP_KEY,
  weeklyRecapSchema,
} from "@superbot/shared";
import { MiniappAdminService } from "./admin.service.js";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "./init-data.guard.js";

const FLOOD_DEFAULT = {
  enabled: false,
  messageLimit: 5,
  windowSeconds: 10,
  action: "mute" as const,
};
const CAPTCHA_DEFAULT = {
  enabled: false,
  mode: "button" as const,
  failAction: "mute" as const,
  timeoutSeconds: 120,
  maxAttempts: 3,
};
const ANTIRAID_DEFAULT = {
  enabled: false,
  mode: "observe" as const,
  joinLimit: 5,
  windowSeconds: 30,
  newAccountAgeDays: 0,
};
// Note: unlike flood/captcha (whose repos return null on miss and are defaulted
// here), the warns and hygiene repos return their own default state when no row
// exists (defaultWarnPolicyState / defaultHygieneState), so readSection just
// maps their fields through.

// Welcome photo upload limits. The bytes are stored in Postgres and re-uploaded
// to Telegram on each welcome, so keep them modest.
const WELCOME_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const welcomeMediaTypeFromMime = (
  mime?: string,
): "jpg" | "png" | "webp" | null => {
  switch ((mime ?? "").toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
};

@Controller("v1/miniapp")
@UseGuards(InitDataGuard)
export class MiniappConfigController {
  private readonly welcome = new PrismaWelcomeRepository();
  private readonly flood = new PrismaAntifloodRepository();
  private readonly captcha = new PrismaCaptchaRepository();
  private readonly locks = new PrismaContentLockRepository();
  private readonly warns = new PrismaModerationExtraRepository();
  private readonly hygiene = new PrismaGroupProtectionRepository();
  private readonly antiraid = new PrismaAntiraidRepository();
  private readonly foundation = new PrismaFoundationRepository();
  private readonly chatSetting = new PrismaChatSettingRepository();

  // Explicit @Inject: tsx/esbuild does not emit decorator metadata.
  constructor(
    @Inject(MiniappAdminService) private readonly admin: MiniappAdminService,
  ) {}

  @Post("session")
  async session(
    @Req() req: MiniappRequest,
    @Body() body?: { startParam?: string },
  ) {
    const ctx = getMiniappContext(req);
    const bot = { username: ctx.botUsername, token: ctx.botToken };
    // Prefer the signed initData start_param; fall back to the body only when
    // absent (child-bot Mini Apps open via web_app buttons with no start_param).
    // The group id merely selects the group — assertGroupAdmin authorizes.
    const effectiveParam =
      ctx.startParam ??
      (typeof body?.startParam === "string" ? body.startParam : null);
    const decoded = decodeStartParam(effectiveParam);
    // `onboarding` resolves the same group as `config` — it just lands the Mini
    // App on the purpose question instead of the config hub.
    if (decoded?.kind !== "config" && decoded?.kind !== "onboarding") {
      // Even with no group, tell the Mini App which bot serves it so a portable
      // hub can adapt its branding to a child bot.
      const identity = await this.admin.botIdentity(bot);
      const botName = await this.admin.botDisplayName(bot);
      return {
        ok: true,
        group: null,
        bot: {
          username: bot.username ?? null,
          name: botName,
          template: identity.template,
          isPrimary: identity.isPrimary,
        },
      };
    }
    await this.admin.assertGroupAdmin(decoded.groupId, ctx.userId, bot);
    const [chat, botName, identity, botIsAdmin] = await Promise.all([
      this.admin.resolveChat(decoded.groupId, bot),
      this.admin.botDisplayName(bot),
      this.admin.botIdentity(bot),
      this.admin.isBotAdmin(decoded.groupId, bot),
    ]);
    return {
      ok: true,
      group: {
        telegramChatId: chat.telegramChatId,
        title: chat.title,
        botIsAdmin,
      },
      bot: {
        username: bot.username ?? null,
        name: botName,
        template: identity.template,
        isPrimary: identity.isPrimary,
      },
    };
  }

  @Get("groups/:gid/games-config")
  async gamesConfig(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const chat = await this.authorize(req, gid);
    const raw = await this.chatSetting.getValue(
      chat.tenantId,
      chat.chatId,
      GAMES_CONFIG_KEY,
    );
    return parseGamesConfig(raw);
  }

  @Put("groups/:gid/games-config")
  async updateGamesConfig(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);
    const parsed = gamesConfigSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: "invalid-body" });
    }
    await this.chatSetting.setValue(
      chat.tenantId,
      chat.chatId,
      GAMES_CONFIG_KEY,
      parsed.data,
    );
    await this.foundation.recordAudit({
      tenantId: chat.tenantId,
      actorType: "user",
      action: "miniapp.games.configured",
      resourceType: "chat_settings",
      resourceId: gid,
      payload: {
        purpose: parsed.data.purpose,
        source: "miniapp",
        telegramUserId: ctx.userId,
      },
    });
    return parsed.data;
  }

  @Get("groups/:gid/schedule-rules")
  async scheduleRules(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const chat = await this.authorize(req, gid);
    const raw = await this.chatSetting.getValue(
      chat.tenantId,
      chat.chatId,
      SCHEDULE_RULES_KEY,
    );
    const parsed = scheduleRulesSchema.safeParse(raw);
    return { rules: parsed.success ? parsed.data : [] };
  }

  @Put("groups/:gid/schedule-rules")
  async updateScheduleRules(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);
    const parsed = scheduleRulesSchema.safeParse(
      (body as { rules?: unknown })?.rules,
    );
    if (!parsed.success) {
      throw new BadRequestException({ error: "invalid-body" });
    }
    await this.chatSetting.setValue(
      chat.tenantId,
      chat.chatId,
      SCHEDULE_RULES_KEY,
      parsed.data,
    );
    await this.foundation.recordAudit({
      tenantId: chat.tenantId,
      actorType: "user",
      action: "miniapp.scheduleRules.updated",
      resourceType: "chat_settings",
      resourceId: gid,
      payload: {
        count: parsed.data.length,
        source: "miniapp",
        telegramUserId: ctx.userId,
      },
    });
    return { rules: parsed.data };
  }

  @Get("groups/:gid/rituals")
  async rituals(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const chat = await this.authorize(req, gid);
    const raw = await this.chatSetting.getValue(
      chat.tenantId,
      chat.chatId,
      RITUALS_KEY,
    );
    const parsed = ritualsSchema.safeParse(raw);
    return { rituals: parsed.success ? parsed.data : [] };
  }

  @Put("groups/:gid/rituals")
  async updateRituals(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);
    const parsed = ritualsSchema.safeParse(
      (body as { rituals?: unknown })?.rituals,
    );
    if (!parsed.success) {
      throw new BadRequestException({ error: "invalid-body" });
    }
    await this.chatSetting.setValue(
      chat.tenantId,
      chat.chatId,
      RITUALS_KEY,
      parsed.data,
    );
    await this.foundation.recordAudit({
      tenantId: chat.tenantId,
      actorType: "user",
      action: "miniapp.rituals.updated",
      resourceType: "chat_settings",
      resourceId: gid,
      payload: {
        count: parsed.data.length,
        source: "miniapp",
        telegramUserId: ctx.userId,
      },
    });
    return { rituals: parsed.data };
  }

  @Get("groups/:gid/quiet")
  async quiet(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const chat = await this.authorize(req, gid);
    const raw = await this.chatSetting.getValue(
      chat.tenantId,
      chat.chatId,
      CHAT_QUIET_KEY,
    );
    const parsed = chatQuietSchema.safeParse(raw);
    return { enabled: parsed.success ? parsed.data.enabled : false };
  }

  @Put("groups/:gid/quiet")
  async updateQuiet(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);
    const parsed = chatQuietSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: "invalid-body" });
    }
    await this.chatSetting.setValue(
      chat.tenantId,
      chat.chatId,
      CHAT_QUIET_KEY,
      parsed.data,
    );
    await this.foundation.recordAudit({
      tenantId: chat.tenantId,
      actorType: "user",
      action: "miniapp.quiet.updated",
      resourceType: "chat_settings",
      resourceId: gid,
      payload: {
        enabled: parsed.data.enabled,
        source: "miniapp",
        telegramUserId: ctx.userId,
      },
    });
    return { enabled: parsed.data.enabled };
  }

  @Get("groups/:gid/reactions")
  async reactions(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const chat = await this.authorize(req, gid);
    const raw = await this.chatSetting.getValue(
      chat.tenantId,
      chat.chatId,
      REACTION_MODERATION_SETTING_KEY,
    );
    // parseReactionModerationConfig always returns a valid config (defaults +
    // clamping), so the UI never has to special-case an empty/corrupt setting.
    return { config: parseReactionModerationConfig(raw) };
  }

  @Put("groups/:gid/reactions")
  async updateReactions(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);
    if (body == null || typeof body !== "object") {
      throw new BadRequestException({ error: "invalid-body" });
    }
    // Never-throws sanitizer: clamps thresholds, trims/dedupes/caps the
    // blocklists and rejects unknown modes, so the stored value is always a
    // valid ReactionModerationConfig regardless of what the client sent.
    const config = parseReactionModerationConfig(body);
    await this.chatSetting.setValue(
      chat.tenantId,
      chat.chatId,
      REACTION_MODERATION_SETTING_KEY,
      config,
    );
    await this.foundation.recordAudit({
      tenantId: chat.tenantId,
      actorType: "user",
      action: "miniapp.reactions.updated",
      resourceType: "chat_settings",
      resourceId: gid,
      payload: {
        mode: config.mode,
        blockedEmojis: config.blockedEmojis.length,
        blockedCustomEmojiIds: config.blockedCustomEmojiIds.length,
        surgeThreshold: config.surgeThreshold,
        source: "miniapp",
        telegramUserId: ctx.userId,
      },
    });
    return { config };
  }

  @Get("groups/:gid/weekly-recap")
  async weeklyRecap(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const chat = await this.authorize(req, gid);
    const raw = await this.chatSetting.getValue(
      chat.tenantId,
      chat.chatId,
      WEEKLY_RECAP_KEY,
    );
    const parsed = weeklyRecapSchema.safeParse(raw);
    return { enabled: parsed.success ? parsed.data.enabled : false };
  }

  @Put("groups/:gid/weekly-recap")
  async updateWeeklyRecap(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);
    const parsed = weeklyRecapSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: "invalid-body" });
    }
    await this.chatSetting.setValue(
      chat.tenantId,
      chat.chatId,
      WEEKLY_RECAP_KEY,
      parsed.data,
    );
    await this.foundation.recordAudit({
      tenantId: chat.tenantId,
      actorType: "user",
      action: "miniapp.weekly-recap.updated",
      resourceType: "chat_settings",
      resourceId: gid,
      payload: {
        enabled: parsed.data.enabled,
        source: "miniapp",
        telegramUserId: ctx.userId,
      },
    });
    return { enabled: parsed.data.enabled };
  }

  // Read-only summary of ALL SECTION_NAMES, no versioning/import semantics.
  // No current Mini App consumer — the web app fetches config section-by-
  // section via GET/PUT /config/:section. Distinct from
  // MiniappBackupController's /backup/export, which is a versioned,
  // re-importable payload with extra data (owner-network, gamification) for
  // the actual "export my config" user flow — don't fold that logic in here,
  // and don't hand-pick a subset of sections again.
  @Get("groups/:gid/config")
  async snapshot(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const chat = await this.authorize(req, gid);
    const entries = await Promise.all(
      SECTION_NAMES.map(async (name) => {
        const value = await this.readSection(name, chat.tenantId, chat.chatId);
        return [name, value] as const;
      }),
    );
    return {
      telegramChatId: chat.telegramChatId,
      title: chat.title,
      sections: Object.fromEntries(entries) as Record<
        SectionName,
        Record<string, unknown>
      >,
    };
  }

  @Get("groups/:gid/config/:section")
  async section(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Param("section") section: string,
  ) {
    if (!isSectionName(section)) {
      throw new BadRequestException({ error: "unknown-section" });
    }
    const chat = await this.authorize(req, gid);
    return this.readSection(section, chat.tenantId, chat.chatId);
  }

  @Put("groups/:gid/config/:section")
  async update(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Param("section") section: string,
    @Body() body: unknown,
  ) {
    if (!isSectionName(section)) {
      throw new BadRequestException({ error: "unknown-section" });
    }
    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);

    const parsed = SECTION_SCHEMAS[section].safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: "invalid-body" });
    }

    await this.writeSection(
      section,
      chat.tenantId,
      chat.chatId,
      chat.telegramChatId,
      parsed.data as never,
    );

    await this.foundation.recordAudit({
      tenantId: chat.tenantId,
      actorType: "user",
      action: `miniapp.${section}.updated`,
      resourceType: "chat_settings",
      resourceId: gid,
      payload: { section, source: "miniapp", telegramUserId: ctx.userId },
    });

    return this.readSection(section, chat.tenantId, chat.chatId);
  }

  // --- Welcome photo (GroupHelp-style) — stored bytes, separate from the
  // text/buttons section PUT because the payload is large and binary. ---

  @Get("groups/:gid/config/welcome/photo")
  async getWelcomePhoto(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const chat = await this.authorize(req, gid);
    const media = await this.welcome.getMedia(chat.chatId);
    return media
      ? { imageBase64: media.data, mimeType: media.mimeType }
      : { imageBase64: null, mimeType: null };
  }

  @Post("groups/:gid/config/welcome/photo")
  async setWelcomePhoto(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: { imageBase64?: string; mimeType?: string } | undefined,
  ) {
    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);

    const mimeType = body?.mimeType;
    const mediaType = welcomeMediaTypeFromMime(mimeType);
    if (!body?.imageBase64 || !mimeType || !mediaType) {
      throw new BadRequestException({ error: "invalid-photo" });
    }
    const bytes = Buffer.from(body.imageBase64, "base64");
    if (bytes.length === 0 || bytes.length > WELCOME_PHOTO_MAX_BYTES) {
      throw new BadRequestException({ error: "invalid-photo-size" });
    }

    await this.welcome.setMedia(
      chat.tenantId,
      chat.chatId,
      mimeType,
      mediaType,
      body.imageBase64,
    );
    await this.foundation.recordAudit({
      tenantId: chat.tenantId,
      actorType: "user",
      action: "miniapp.welcome.photo.set",
      resourceType: "welcome_config",
      resourceId: gid,
      payload: { source: "miniapp", telegramUserId: ctx.userId },
    });
    return { ok: true };
  }

  @Delete("groups/:gid/config/welcome/photo")
  async deleteWelcomePhoto(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
  ) {
    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);
    await this.welcome.clearMedia(chat.chatId);
    await this.foundation.recordAudit({
      tenantId: chat.tenantId,
      actorType: "user",
      action: "miniapp.welcome.photo.cleared",
      resourceType: "welcome_config",
      resourceId: gid,
      payload: { source: "miniapp", telegramUserId: ctx.userId },
    });
    return { ok: true };
  }

  private async authorize(req: MiniappRequest, gid: string) {
    const ctx = getMiniappContext(req);
    const bot = { username: ctx.botUsername, token: ctx.botToken };
    await this.admin.assertGroupAdmin(gid, ctx.userId, bot);
    return this.admin.resolveChat(gid, bot);
  }

  private async readSection(
    section: SectionName,
    tenantId: string,
    chatId: string,
  ): Promise<Record<string, unknown>> {
    switch (section) {
      case "behavior": {
        const cfg = await this.hygiene.getHygiene(chatId);
        return {
          passiveMode: cfg.passiveMode,
          autoModeration: cfg.autoModeration,
          autoCleanup: cfg.autoCleanup,
          autoMessages: cfg.autoMessages,
        };
      }
      case "welcome": {
        const cfg = await this.welcome.getConfig(chatId);
        return {
          welcomeText: cfg?.welcomeText ?? null,
          goodbyeText: cfg?.goodbyeText ?? null,
          welcomeButtons: cfg?.welcomeButtons ?? [],
        };
      }
      case "rules": {
        const cfg = await this.welcome.getConfig(chatId);
        return { rulesText: cfg?.rulesText ?? null };
      }
      case "flood": {
        const cfg = await this.flood.getConfig(tenantId, chatId);
        return cfg
          ? {
              enabled: cfg.enabled,
              messageLimit: cfg.messageLimit,
              windowSeconds: cfg.windowSeconds,
              action: cfg.action,
            }
          : { ...FLOOD_DEFAULT };
      }
      case "captcha": {
        const cfg = await this.captcha.getConfig(tenantId, chatId);
        return cfg
          ? {
              enabled: cfg.enabled,
              mode: cfg.mode,
              failAction: cfg.failAction,
              timeoutSeconds: cfg.timeoutSeconds,
              maxAttempts: cfg.maxAttempts,
            }
          : { ...CAPTCHA_DEFAULT };
      }
      case "locks": {
        const locked = await this.locks.getLocked(tenantId, chatId);
        return { locked };
      }
      case "warns": {
        const cfg = await this.warns.getWarnPolicy(chatId);
        return {
          warnLimit: cfg.warnLimit,
          warnMode: cfg.warnMode,
          durationMs: cfg.durationMs ?? null,
          expireMs: cfg.expireMs ?? null,
        };
      }
      case "hygiene": {
        const cfg = await this.hygiene.getHygiene(chatId);
        return {
          cleanService: cfg.cleanService,
          cleanWelcome: cfg.cleanWelcome,
          nightMode: cfg.nightMode,
          nightStart: cfg.nightStart,
          nightEnd: cfg.nightEnd,
          welcomeMute: cfg.welcomeMute,
          autoApprove: cfg.autoApprove,
          rtlFilter: cfg.rtlFilter,
          cjkFilter: cfg.cjkFilter,
          language: cfg.language,
          blockKnownSpammers: cfg.blockKnownSpammers,
        };
      }
      case "membershipGate": {
        const cfg = await this.hygiene.getMembershipGate(chatId);
        return {
          requiredTelegramChatId: cfg
            ? cfg.requiredTelegramChatId.toString()
            : null,
        };
      }
      case "raid": {
        const cfg = await this.antiraid.getConfig(tenantId, chatId);
        return cfg
          ? {
              enabled: cfg.enabled,
              mode: cfg.mode,
              joinLimit: cfg.joinLimit,
              windowSeconds: cfg.windowSeconds,
              newAccountAgeDays: cfg.newAccountAgeDays,
            }
          : { ...ANTIRAID_DEFAULT };
      }
    }
  }

  private async writeSection(
    section: SectionName,
    tenantId: string,
    chatId: string,
    telegramChatId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    switch (section) {
      case "behavior":
        await this.hygiene.setHygiene(tenantId, chatId, {
          passiveMode: data.passiveMode as boolean,
          autoModeration: data.autoModeration as boolean,
          autoCleanup: data.autoCleanup as boolean,
          autoMessages: data.autoMessages as boolean,
        });
        return;
      case "welcome":
        await this.welcome.upsertConfig(tenantId, chatId, {
          welcomeText: data.welcomeText as string | null,
          goodbyeText: data.goodbyeText as string | null,
          // Only touch buttons when the client sent them, so a text-only save
          // doesn't wipe configured buttons.
          ...(data.welcomeButtons !== undefined
            ? {
                welcomeButtons: data.welcomeButtons as {
                  type: string;
                  text: string;
                  url?: string;
                }[],
              }
            : {}),
        });
        return;
      case "rules":
        await this.welcome.upsertConfig(tenantId, chatId, {
          rulesText: data.rulesText as string | null,
        });
        return;
      case "flood":
        await this.flood.upsertConfig(tenantId, chatId, {
          enabled: data.enabled as boolean,
          messageLimit: data.messageLimit as number,
          windowSeconds: data.windowSeconds as number,
          action: data.action as "warn" | "mute" | "ban" | "delete",
        });
        return;
      case "captcha":
        await this.captcha.upsertConfig(tenantId, chatId, {
          enabled: data.enabled as boolean,
          mode: data.mode as "button" | "math" | "text",
          failAction: data.failAction as "mute" | "ban" | "restrict",
          timeoutSeconds: data.timeoutSeconds as number,
          maxAttempts: data.maxAttempts as number,
        });
        return;
      case "locks":
        await this.locks.setLocked(tenantId, chatId, data.locked as string[]);
        return;
      case "warns":
        await this.warns.setWarnPolicy(tenantId, chatId, {
          warnLimit: data.warnLimit as number,
          warnMode: data.warnMode as "ban" | "kick" | "mute" | "tban" | "tmute",
          durationMs: data.durationMs as number | null,
          expireMs: data.expireMs as number | null,
        });
        return;
      case "hygiene":
        await this.hygiene.setHygiene(tenantId, chatId, {
          cleanService: data.cleanService as boolean,
          cleanWelcome: data.cleanWelcome as boolean,
          nightMode: data.nightMode as boolean,
          nightStart: data.nightStart as number,
          nightEnd: data.nightEnd as number,
          welcomeMute: data.welcomeMute as boolean,
          autoApprove: data.autoApprove as boolean,
          rtlFilter: data.rtlFilter as boolean,
          cjkFilter: data.cjkFilter as boolean,
          language: data.language as string,
          blockKnownSpammers: data.blockKnownSpammers as boolean,
        });
        return;
      case "membershipGate": {
        const raw = data.requiredTelegramChatId as string | null;
        await this.hygiene.setMembershipGate(
          tenantId,
          chatId,
          BigInt(telegramChatId),
          raw === null ? null : BigInt(raw),
        );
        return;
      }
      case "raid":
        await this.antiraid.upsertConfig(tenantId, chatId, {
          enabled: data.enabled as boolean,
          mode: data.mode as "observe" | "enforce",
          joinLimit: data.joinLimit as number,
          windowSeconds: data.windowSeconds as number,
          newAccountAgeDays: data.newAccountAgeDays as number,
        });
        return;
    }
  }
}
