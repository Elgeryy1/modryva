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
  type ActivityWindowRow,
  PrismaAnalyticsRepository,
  PrismaAntifloodRepository,
  PrismaCaptchaRepository,
  PrismaD1Repository,
  PrismaFederationRepository,
  PrismaWelcomeRepository,
  type TopPosterRow,
} from "@superbot/data";
import { MiniappAdminService } from "./admin.service.js";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "./init-data.guard.js";

const RECENT_DAYS = 14;
const TOP_POSTERS_LIMIT = 10;
const RAID_SPAM_EVENT_LIMIT = 500;

interface UnconfiguredChat {
  readonly chatId: string;
  readonly telegramChatId: string;
  readonly missingCaptcha: boolean;
  readonly missingAntiflood: boolean;
  readonly missingWelcome: boolean;
}

interface DoctorRecommendation {
  readonly id: string;
  readonly text: string;
}

interface MergedTopPoster {
  readonly telegramUserId: string;
  readonly username: string | undefined;
  readonly messages: number;
}

interface NetworkAnalyticsPayload {
  readonly chatCount: number;
  readonly totalMessages: number;
  readonly activeUsers: number;
  readonly recentDays: ActivityWindowRow[];
  readonly topPosters: MergedTopPoster[];
  readonly hourlyRaidSpamEvents: number[];
  readonly unconfiguredChats: UnconfiguredChat[];
  readonly healthScore: number;
  readonly recommendations: DoctorRecommendation[];
}

@Controller("v1/miniapp")
@UseGuards(InitDataGuard)
export class MiniappNetworkAnalyticsController {
  private readonly analytics = new PrismaAnalyticsRepository();
  private readonly antiflood = new PrismaAntifloodRepository();
  private readonly captcha = new PrismaCaptchaRepository();
  private readonly d1 = new PrismaD1Repository();
  private readonly federation = new PrismaFederationRepository();
  private readonly welcome = new PrismaWelcomeRepository();

  constructor(private readonly admin: MiniappAdminService) {}

  @Get("groups/:gid/network/analytics")
  async analyticsView(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const auth = await this.requireNetworkAdmin(req, gid);
    const chatIds = await this.resolveNetworkChatIds(auth);
    return this.buildAnalytics(auth.chat.tenantId, chatIds);
  }

  @Post("groups/:gid/network/doctor/fix")
  async applyFix(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const recommendationId = (body as { recommendationId?: unknown } | null)
      ?.recommendationId;
    if (
      typeof recommendationId !== "string" ||
      recommendationId.trim().length === 0
    ) {
      throw new BadRequestException({ error: "invalid-body" });
    }

    const auth = await this.requireNetworkAdmin(req, gid);
    const chatIds = await this.resolveNetworkChatIds(auth);
    const applied = await this.applyRecommendation(
      auth.chat.tenantId,
      chatIds,
      recommendationId,
    );
    if (!applied) {
      throw new BadRequestException({ error: "no-auto-fix" });
    }

    return this.buildAnalytics(auth.chat.tenantId, chatIds);
  }

  private async buildAnalytics(
    tenantId: string,
    chatIds: readonly string[],
  ): Promise<NetworkAnalyticsPayload> {
    const [recentByChat, totalsByChat, topPostersByChat, activeByChat] =
      await Promise.all([
        Promise.all(
          chatIds.map((chatId) =>
            this.analytics.getRecentDays(chatId, RECENT_DAYS),
          ),
        ),
        Promise.all(chatIds.map((chatId) => this.analytics.getTotal(chatId))),
        Promise.all(
          chatIds.map((chatId) =>
            this.analytics.getTopPosters(chatId, TOP_POSTERS_LIMIT),
          ),
        ),
        Promise.all(
          chatIds.map((chatId) => this.analytics.getActiveUserCount(chatId)),
        ),
      ]);

    const recentDays = mergeRecentDays(recentByChat);
    const totalMessages = totalsByChat.reduce((sum, total) => sum + total, 0);
    const activeUsers = activeByChat.reduce((sum, count) => sum + count, 0);
    const topPosters = mergeTopPosters(topPostersByChat.flat());

    const hourlyRaidSpamEvents = await this.computeHourlyRaidSpamEvents(
      tenantId,
      chatIds,
    );

    const { unconfiguredChats, captchaOn, antifloodOn, d1On, welcomeOn } =
      await this.computeConfigState(tenantId, chatIds);

    const healthScore = computeHealthScore({
      chatCount: chatIds.length,
      captchaOn,
      antifloodOn,
      d1On,
      welcomeOn,
    });

    const recommendations = buildRecommendations(unconfiguredChats);

    return {
      chatCount: chatIds.length,
      totalMessages,
      activeUsers,
      recentDays,
      topPosters,
      hourlyRaidSpamEvents,
      unconfiguredChats,
      healthScore,
      recommendations,
    };
  }

  private async computeHourlyRaidSpamEvents(
    tenantId: string,
    chatIds: readonly string[],
  ): Promise<number[]> {
    const buckets = new Array<number>(24).fill(0);
    const eventsByChat = await Promise.all(
      chatIds.map((chatId) =>
        this.d1.listEvents(tenantId, chatId, RAID_SPAM_EVENT_LIMIT),
      ),
    );
    for (const events of eventsByChat) {
      for (const event of events) {
        const kind = event.kind.toLowerCase();
        if (!kind.includes("raid") && !kind.includes("spam")) {
          continue;
        }
        const hour = event.createdAt.getUTCHours();
        buckets[hour] = (buckets[hour] ?? 0) + 1;
      }
    }
    return buckets;
  }

  private async computeConfigState(
    tenantId: string,
    chatIds: readonly string[],
  ): Promise<{
    unconfiguredChats: UnconfiguredChat[];
    captchaOn: number;
    antifloodOn: number;
    d1On: number;
    welcomeOn: number;
  }> {
    const unconfiguredChats: UnconfiguredChat[] = [];
    let captchaOn = 0;
    let antifloodOn = 0;
    let d1On = 0;
    let welcomeOn = 0;

    for (const chatId of chatIds) {
      const [captchaConfig, antifloodConfig, welcomeConfig, d1Config] =
        await Promise.all([
          this.captcha.getConfig(tenantId, chatId),
          this.antiflood.getConfig(tenantId, chatId),
          this.welcome.getConfig(chatId),
          this.d1.getLogConfig(chatId),
        ]);

      const missingCaptcha = !captchaConfig?.enabled;
      const missingAntiflood = !antifloodConfig?.enabled;
      const missingWelcome = !welcomeConfig?.welcomeText;

      if (!missingCaptcha) {
        captchaOn += 1;
      }
      if (!missingAntiflood) {
        antifloodOn += 1;
      }
      if (!missingWelcome) {
        welcomeOn += 1;
      }
      if (d1Config?.enabled) {
        d1On += 1;
      }

      if (missingCaptcha || missingAntiflood || missingWelcome) {
        unconfiguredChats.push({
          chatId,
          telegramChatId: chatId,
          missingCaptcha,
          missingAntiflood,
          missingWelcome,
        });
      }
    }

    return { unconfiguredChats, captchaOn, antifloodOn, d1On, welcomeOn };
  }

  private async applyRecommendation(
    tenantId: string,
    chatIds: readonly string[],
    recommendationId: string,
  ): Promise<boolean> {
    const { unconfiguredChats } = await this.computeConfigState(
      tenantId,
      chatIds,
    );
    const recommendations = buildRecommendations(unconfiguredChats);
    const match = recommendations.find((rec) => rec.id === recommendationId);
    if (!match) {
      return false;
    }

    if (recommendationId === "enable-captcha") {
      await Promise.all(
        unconfiguredChats
          .filter((chat) => chat.missingCaptcha)
          .map((chat) =>
            this.captcha.upsertConfig(tenantId, chat.chatId, {
              enabled: true,
              mode: "button",
              timeoutSeconds: 120,
              maxAttempts: 3,
              failAction: "mute",
            }),
          ),
      );
      return true;
    }

    if (recommendationId === "enable-antiflood") {
      await Promise.all(
        unconfiguredChats
          .filter((chat) => chat.missingAntiflood)
          .map((chat) =>
            this.antiflood.upsertConfig(tenantId, chat.chatId, {
              enabled: true,
              windowSeconds: 10,
              messageLimit: 8,
              action: "mute",
              muteSeconds: 300,
              cooldownSeconds: 60,
            }),
          ),
      );
      return true;
    }

    return false;
  }

  private async resolveNetworkChatIds(
    auth: AuthorizedMiniapp,
  ): Promise<string[]> {
    const fed = await this.federation.getFederationForChat(auth.chat.chatId);
    if (!fed) {
      return [auth.chat.chatId];
    }
    const chats = await this.federation.listFederationChats(fed.fedId);
    return chats.length > 0
      ? chats.map((chat) => chat.chatId)
      : [auth.chat.chatId];
  }

  private async authorize(
    req: MiniappRequest,
    gid: string,
  ): Promise<AuthorizedMiniapp> {
    const ctx = getMiniappContext(req);
    const bot = { username: ctx.botUsername, token: ctx.botToken };
    await this.admin.assertGroupAdmin(gid, ctx.userId, bot);
    const chat = await this.admin.resolveChat(gid, bot);
    return {
      chat,
      gid,
      userId: BigInt(ctx.userId),
      telegramUserId: ctx.userId,
    };
  }

  private async requireNetworkAdmin(
    req: MiniappRequest,
    gid: string,
  ): Promise<AuthorizedMiniapp> {
    const auth = await this.authorize(req, gid);
    const fed = await this.federation.getFederationForChat(auth.chat.chatId);
    if (!fed) {
      return auth;
    }
    const isOwner = fed.ownerTelegramId === auth.userId;
    const isNetworkAdmin =
      isOwner || (await this.federation.isFedAdmin(fed.fedId, auth.userId));
    if (!isNetworkAdmin) {
      throw new ForbiddenException({ error: "not-network-admin" });
    }
    return auth;
  }
}

interface AuthorizedMiniapp {
  readonly chat: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly telegramChatId: string;
    readonly title?: string | undefined;
  };
  readonly gid: string;
  readonly userId: bigint;
  readonly telegramUserId: string;
}

const mergeRecentDays = (
  perChat: readonly ActivityWindowRow[][],
): ActivityWindowRow[] => {
  const byDay = new Map<string, number>();
  for (const rows of perChat) {
    for (const row of rows) {
      byDay.set(row.day, (byDay.get(row.day) ?? 0) + row.messages);
    }
  }
  return [...byDay.entries()]
    .map(([day, messages]) => ({ day, messages }))
    .sort((a, b) => (a.day < b.day ? 1 : -1));
};

const mergeTopPosters = (rows: readonly TopPosterRow[]): MergedTopPoster[] => {
  const byUser = new Map<string, TopPosterRow>();
  for (const row of rows) {
    const key = row.telegramUserId.toString();
    const current = byUser.get(key);
    byUser.set(key, {
      telegramUserId: row.telegramUserId,
      username: row.username ?? current?.username,
      messages: (current?.messages ?? 0) + row.messages,
    });
  }
  return [...byUser.values()]
    .sort((a, b) => b.messages - a.messages)
    .slice(0, TOP_POSTERS_LIMIT)
    .map((row) => ({ ...row, telegramUserId: row.telegramUserId.toString() }));
};

const computeHealthScore = (input: {
  chatCount: number;
  captchaOn: number;
  antifloodOn: number;
  d1On: number;
  welcomeOn: number;
}): number => {
  if (input.chatCount === 0) {
    return 0;
  }
  const fraction = (n: number) => n / input.chatCount;
  const weighted =
    fraction(input.captchaOn) * 0.3 +
    fraction(input.antifloodOn) * 0.3 +
    fraction(input.d1On) * 0.2 +
    fraction(input.welcomeOn) * 0.2;
  return Math.round(weighted * 100);
};

const buildRecommendations = (
  unconfiguredChats: readonly UnconfiguredChat[],
): DoctorRecommendation[] => {
  const recommendations: DoctorRecommendation[] = [];
  const missingCaptchaCount = unconfiguredChats.filter(
    (chat) => chat.missingCaptcha,
  ).length;
  const missingAntifloodCount = unconfiguredChats.filter(
    (chat) => chat.missingAntiflood,
  ).length;
  const missingWelcomeCount = unconfiguredChats.filter(
    (chat) => chat.missingWelcome,
  ).length;

  if (missingCaptchaCount > 0) {
    recommendations.push({
      id: "enable-captcha",
      text: `${missingCaptchaCount} grupo(s) sin captcha: activalo con valores por defecto.`,
    });
  }
  if (missingAntifloodCount > 0) {
    recommendations.push({
      id: "enable-antiflood",
      text: `${missingAntifloodCount} grupo(s) sin antiflood: activalo con valores por defecto.`,
    });
  }
  if (missingWelcomeCount > 0) {
    recommendations.push({
      id: "configure-welcome",
      text: `${missingWelcomeCount} grupo(s) sin mensaje de bienvenida configurado.`,
    });
  }

  return recommendations;
};
