import {
  BadRequestException,
  Body,
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
  type FederationRecord,
  PrismaEntitlementRepository,
  PrismaFederationRepository,
} from "@superbot/data";
import { getRuntimeEnv } from "@superbot/shared";
import { z } from "zod";
import { MiniappAdminService } from "./admin.service.js";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "./init-data.guard.js";

const redeemSchema = z.object({
  code: z.string().min(1).max(128),
});

const generateCodeSchema = z.object({
  plan: z.string().min(1).max(32),
  maxChats: z.number().int().positive().max(1000),
  days: z.number().int().positive().max(3650),
});

@Controller("v1/miniapp")
@UseGuards(InitDataGuard)
export class MiniappEntitlementController {
  private readonly entitlement = new PrismaEntitlementRepository();
  private readonly federation = new PrismaFederationRepository();

  constructor(
    @Inject(MiniappAdminService) private readonly admin: MiniappAdminService,
  ) {}

  @Get("groups/:gid/entitlement")
  async status(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const auth = await this.authorize(req, gid);
    const fed = await this.federation.getFederationForChat(auth.chat.chatId);
    return this.view(fed);
  }

  @Post("groups/:gid/entitlement/redeem")
  async redeem(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const parsed = redeemSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: "invalid-body" });
    }

    const auth = await this.requireNetworkAdmin(req, gid);
    const result = await this.entitlement.redeemCode(
      auth.fed.fedId,
      parsed.data.code,
      auth.telegramUserId,
    );
    if (!result.ok) {
      throw new BadRequestException({ error: result.reason });
    }

    return this.view(auth.fed);
  }

  @Post("groups/:gid/entitlement/codes")
  async generateCode(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const ctx = getMiniappContext(req);
    const env = getRuntimeEnv();
    if (
      env.SUPERBOT_OWNER_TELEGRAM_ID == null ||
      env.SUPERBOT_OWNER_TELEGRAM_ID !== BigInt(ctx.userId)
    ) {
      throw new ForbiddenException({ error: "not-platform-owner" });
    }

    const parsed = generateCodeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: "invalid-body" });
    }

    await this.authorize(req, gid);
    const code = await this.entitlement.generateCode(
      ctx.userId,
      parsed.data.plan,
      parsed.data.maxChats,
      parsed.data.days,
    );
    return { code };
  }

  private async view(fed: FederationRecord | null) {
    const fedId = fed?.fedId ?? null;
    const [entitlement, chatCount] = await Promise.all([
      fedId
        ? this.entitlement.getEntitlement(fedId)
        : Promise.resolve({
            plan: "free" as const,
            maxChats: 3,
            premiumUntil: null,
            grantedByCode: null,
          }),
      fedId ? this.federation.countFedChats(fedId) : Promise.resolve(0),
    ]);

    return {
      inNetwork: Boolean(fed),
      plan: entitlement.plan,
      maxChats: entitlement.maxChats,
      chatCount,
      premiumUntil: entitlement.premiumUntil?.toISOString() ?? null,
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
    const isOwner = fed.ownerTelegramId === auth.userId;
    const isNetworkAdmin =
      isOwner || (await this.federation.isFedAdmin(fed.fedId, auth.userId));
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
