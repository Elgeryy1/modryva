import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  classifyRisk,
  type FederationRecord,
  PrismaFederationRepository,
  PrismaOwnerNetworkRiskRepository,
  type RiskProfileRecord,
} from "@superbot/data";
import { MiniappAdminService } from "./admin.service.js";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "./init-data.guard.js";

const DEFAULT_LIMIT = 20;

@Controller("v1/miniapp")
@UseGuards(InitDataGuard)
export class MiniappNetworkRiskController {
  private readonly federation = new PrismaFederationRepository();
  private readonly risk = new PrismaOwnerNetworkRiskRepository();

  constructor(
    @Inject(MiniappAdminService) private readonly admin: MiniappAdminService,
  ) {}

  @Get("groups/:gid/network/risk")
  async list(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const auth = await this.authorize(req, gid);
    const fed = await this.federation.getFederationForChat(auth.chat.chatId);
    if (!fed) {
      return { inNetwork: false as const };
    }
    const isNetworkAdmin = await this.isNetworkAdmin(fed, auth.userId);
    if (!isNetworkAdmin) {
      throw new ForbiddenException({ error: "not-network-admin" });
    }
    const profiles = await this.risk.listTopRisk(fed.fedId, DEFAULT_LIMIT);
    return {
      inNetwork: true as const,
      networkId: fed.fedId,
      users: profiles.map(toView),
    };
  }

  @Post("groups/:gid/network/risk/:userId/reset")
  async reset(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Param("userId") userId: string,
  ) {
    const auth = await this.requireNetworkAdmin(req, gid);
    let telegramUserId: bigint;
    try {
      telegramUserId = BigInt(userId);
    } catch {
      throw new BadRequestException({ error: "invalid-user-id" });
    }
    await this.risk.resetProfile(auth.fed.fedId, telegramUserId);
    return { ok: true as const };
  }

  private async isNetworkAdmin(
    fed: FederationRecord,
    userId: bigint,
  ): Promise<boolean> {
    const isOwner = fed.ownerTelegramId === userId;
    return isOwner || (await this.federation.isFedAdmin(fed.fedId, userId));
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
  ): Promise<AuthorizedMiniapp & { fed: FederationRecord }> {
    const auth = await this.authorize(req, gid);
    const fed = await this.federation.getFederationForChat(auth.chat.chatId);
    if (!fed) {
      throw new BadRequestException({ error: "not-in-network" });
    }
    const isNetworkAdmin = await this.isNetworkAdmin(fed, auth.userId);
    if (!isNetworkAdmin) {
      throw new ForbiddenException({ error: "not-network-admin" });
    }
    return { ...auth, fed };
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

const toView = (profile: RiskProfileRecord) => ({
  telegramUserId: profile.telegramUserId.toString(),
  score: profile.score,
  classification: classifyRisk(profile.score),
  deletedCount: profile.deletedCount,
  reportCount: profile.reportCount,
  quarantineCount: profile.quarantineCount,
  linkCount: profile.linkCount,
  sanctionCount: profile.sanctionCount,
  chatCount: profile.chatIds.length,
  updatedAt: profile.updatedAt.toISOString(),
});
