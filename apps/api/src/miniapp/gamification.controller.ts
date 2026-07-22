import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  PrismaFederationRepository,
  PrismaGamificationRepository,
  PrismaReputationRepository,
} from "@superbot/data";
import { z } from "zod";
import { MiniappAdminService } from "./admin.service.js";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "./init-data.guard.js";

const NETWORK_RANKING_LIMIT = 20;
const GROUP_RANKING_LIMIT = 20;

const welcomeButtonsSchema = z.object({
  rules: z.boolean(),
  otherGroups: z.boolean(),
  support: z.boolean(),
  verify: z.boolean(),
});

@Controller("v1/miniapp")
@UseGuards(InitDataGuard)
export class MiniappGamificationController {
  private readonly federation = new PrismaFederationRepository();
  private readonly gamification = new PrismaGamificationRepository();
  private readonly reputation = new PrismaReputationRepository();

  constructor(
    @Inject(MiniappAdminService) private readonly admin: MiniappAdminService,
  ) {}

  @Get("groups/:gid/gamification")
  async status(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const auth = await this.authorize(req, gid);
    const groupRanking = await this.reputation.top(
      auth.chat.chatId,
      GROUP_RANKING_LIMIT,
    );

    const [fed, welcomeButtons] = await Promise.all([
      this.federation.getFederationForChat(auth.chat.chatId),
      this.gamification.getWelcomeButtons(auth.chat.tenantId, auth.chat.chatId),
    ]);
    if (!fed) {
      return {
        inNetwork: false as const,
        welcomeButtons,
        groupRanking: groupRanking.map((row) => ({
          telegramUserId: row.telegramUserId.toString(),
          points: row.points,
        })),
      };
    }

    const [missions, badges, networkRanking] = await Promise.all([
      this.gamification.ensureMissions(
        auth.chat.tenantId,
        fed.fedId,
        auth.userId,
      ),
      this.gamification.listBadges(fed.fedId, auth.userId),
      this.gamification.getNetworkRanking(fed.fedId, NETWORK_RANKING_LIMIT),
    ]);

    return {
      inNetwork: true as const,
      fedId: fed.fedId,
      welcomeButtons,
      missions: missions.map((mission) => ({
        kind: mission.kind,
        completed: mission.completedAt !== null,
        completedAt: mission.completedAt?.toISOString() ?? null,
      })),
      badges,
      networkRanking: networkRanking.map((row) => ({
        telegramUserId: row.telegramUserId.toString(),
        badgeCount: row.badgeCount,
      })),
      groupRanking: groupRanking.map((row) => ({
        telegramUserId: row.telegramUserId.toString(),
        points: row.points,
      })),
    };
  }

  @Post("groups/:gid/gamification/welcome-buttons")
  async updateWelcomeButtons(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const parsed = welcomeButtonsSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: "invalid-body" });
    }

    const auth = await this.authorize(req, gid);
    const saved = await this.gamification.setWelcomeButtons(
      auth.chat.tenantId,
      auth.chat.chatId,
      parsed.data,
    );
    return {
      persisted: true as const,
      ...saved,
    };
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
    };
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
}
