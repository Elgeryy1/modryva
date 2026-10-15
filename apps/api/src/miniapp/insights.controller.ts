import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  type MemberActivityProfileRow,
  PrismaAnalyticsRepository,
  PrismaFoundationRepository,
} from "@superbot/data";
import { detectDormantMembers } from "@superbot/module-community";
import { MiniappAdminService } from "./admin.service.js";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "./init-data.guard.js";

// A newly observed member gets a 24h grace period. A one-time historical scan
// proves the member had zero messages before the scan, so it can be reported
// immediately without pretending the scan timestamp was their join time.
const GHOST_GRACE_MS = 24 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;
const INACTIVE_AFTER_MS = 14 * DAY_MS;

interface GhostView {
  readonly userId: string;
  readonly username: string | null;
  readonly observedAt: string;
}

interface InactiveView {
  readonly userId: string;
  readonly username: string | null;
  readonly idleDays: number;
  readonly lastActiveAt: string;
}

const lastActivityAt = (profile: {
  readonly historicalLastMessageAt: Date | undefined;
  readonly liveLastMessageAt: Date | undefined;
}): Date | undefined => {
  const historical = profile.historicalLastMessageAt;
  const live = profile.liveLastMessageAt;
  if (historical === undefined) return live;
  if (live === undefined) return historical;
  return historical > live ? historical : live;
};

const isGhost = (profile: MemberActivityProfileRow, now: number): boolean => {
  const messages = profile.historicalMessages + profile.liveMessages;
  return (
    messages === 0 &&
    (profile.historyScannedAt !== undefined ||
      now - profile.membershipObservedAt.getTime() > GHOST_GRACE_MS)
  );
};

const isInactive = (
  profile: MemberActivityProfileRow,
  now: number,
): boolean => {
  const lastActive = lastActivityAt(profile);
  return (
    lastActive !== undefined && now - lastActive.getTime() >= INACTIVE_AFTER_MS
  );
};

/**
 * Read-only member insights. The query reads privacy-minimized aggregates,
 * not the rolling message-content log, and deliberately exposes no moderation
 * or membership-changing action.
 */
@Controller("v1/miniapp")
@UseGuards(InitDataGuard)
export class MiniappInsightsController {
  private readonly analytics = new PrismaAnalyticsRepository();
  private readonly foundation = new PrismaFoundationRepository();

  constructor(
    @Inject(MiniappAdminService) private readonly admin: MiniappAdminService,
  ) {}

  @Get("groups/:gid/insights/ghosts")
  async ghosts(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const chat = await this.authorize(req, gid);
    const profiles = await this.analytics.getMemberActivityProfiles(
      chat.tenantId,
      chat.chatId,
    );
    const now = Date.now();
    const ghosts = profiles.filter((profile) => isGhost(profile, now));

    const view: GhostView[] = ghosts.map((profile) => ({
      userId: profile.telegramUserId.toString(),
      username: profile.username ?? null,
      observedAt: profile.membershipObservedAt.toISOString(),
    }));
    return { total: ghosts.length, ghosts: view };
  }

  @Get("groups/:gid/insights/inactive")
  async inactive(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const chat = await this.authorize(req, gid);
    const profiles = await this.analytics.getMemberActivityProfiles(
      chat.tenantId,
      chat.chatId,
    );
    const members = profiles.flatMap((profile) => {
      const lastActiveAt = lastActivityAt(profile);
      return lastActiveAt === undefined
        ? []
        : [
            {
              userId: profile.telegramUserId.toString(),
              lastActiveMs: lastActiveAt.getTime(),
            },
          ];
    });
    const dormant = detectDormantMembers(members, Date.now());
    const profileById = new Map(
      profiles.map((profile) => [profile.telegramUserId.toString(), profile]),
    );

    const view: InactiveView[] = dormant.flatMap((member) => {
      const profile = profileById.get(member.userId);
      const lastActiveAt = profile ? lastActivityAt(profile) : undefined;
      if (!profile || !lastActiveAt) return [];
      return [
        {
          userId: member.userId.toString(),
          username: profile.username ?? null,
          idleDays: Math.floor(member.idleMs / DAY_MS),
          lastActiveAt: lastActiveAt.toISOString(),
        },
      ];
    });
    return { total: dormant.length, inactive: view };
  }

  /**
   * Explicit, one-member removal from a row the administrator is reviewing.
   * There is deliberately no collection input, selection state, or bulk route.
   */
  @Post("groups/:gid/insights/members/:userId/kick")
  async kick(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Param("userId") userId: string,
  ) {
    if (!/^\d+$/u.test(userId)) {
      throw new BadRequestException({ error: "invalid-user-id" });
    }

    const ctx = getMiniappContext(req);
    const bot = { username: ctx.botUsername, token: ctx.botToken };
    // A membership-changing action never uses the read cache or owner bypass.
    await this.admin.assertGroupAdminForMutation(gid, ctx.userId, bot);
    const chat = await this.admin.resolveChat(gid, bot);
    const targetTelegramUserId = BigInt(userId);
    const profiles = await this.analytics.getMemberActivityProfiles(
      chat.tenantId,
      chat.chatId,
    );
    const target = profiles.find(
      (profile) => profile.telegramUserId === targetTelegramUserId,
    );
    if (
      !target ||
      (!isGhost(target, Date.now()) && !isInactive(target, Date.now()))
    ) {
      throw new BadRequestException({ error: "member-no-longer-eligible" });
    }

    await this.admin.assertMemberCanBeKicked({
      telegramChatId: gid,
      actorTelegramUserId: ctx.userId,
      targetTelegramUserId,
      bot,
    });
    try {
      await this.admin.kickMember({
        telegramChatId: gid,
        targetTelegramUserId,
        bot,
      });
    } catch {
      // Do not expose Telegram's response body, which can reveal unnecessary
      // membership details. The UI can simply refresh its reviewed list.
      throw new BadRequestException({ error: "kick-failed" });
    }

    await this.foundation.recordAudit({
      tenantId: chat.tenantId,
      actorType: "user",
      action: "miniapp.insights.member.kick",
      resourceType: "telegram_member",
      resourceId: `${gid}:${userId}`,
      payload: {
        source: "miniapp",
        actorTelegramUserId: ctx.userId,
        targetTelegramUserId: userId,
      },
    });
    return { ok: true, removedUserId: userId };
  }

  private async authorize(req: MiniappRequest, gid: string) {
    const ctx = getMiniappContext(req);
    const bot = { username: ctx.botUsername, token: ctx.botToken };
    await this.admin.assertGroupAdmin(gid, ctx.userId, bot);
    return this.admin.resolveChat(gid, bot);
  }
}
