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
  AI_PACK_STARS_PRICE,
  AI_PACK_SUBSCRIPTION_PERIOD_SECONDS,
  type AiAccessScope,
  type AiSubscriptionRecord,
  PrismaAiAccessRepository,
} from "@superbot/data";
import { HttpTelegramGateway } from "@superbot/telegram";
import { MiniappAdminService } from "./admin.service.js";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "./init-data.guard.js";

const serializeSubscription = (sub: AiSubscriptionRecord | undefined) =>
  sub
    ? {
        active: true,
        canceled: sub.canceled,
        currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
      }
    : { active: false, canceled: false, currentPeriodEnd: null };

@Controller("v1/miniapp")
@UseGuards(InitDataGuard)
export class AiPackController {
  private readonly aiAccess = new PrismaAiAccessRepository();
  private readonly gateway = new HttpTelegramGateway();

  constructor(
    @Inject(MiniappAdminService) private readonly admin: MiniappAdminService,
  ) {}

  @Get("groups/:gid/ai-pack")
  async chatStatus(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const ctx = getMiniappContext(req);
    const bot = { username: ctx.botUsername, token: ctx.botToken };
    await this.admin.assertGroupAdmin(gid, ctx.userId, bot);
    const chat = await this.admin.resolveChat(gid, bot);
    const sub = await this.aiAccess.getSubscription(
      "chat",
      BigInt(chat.telegramChatId),
    );
    return {
      scope: "chat" as AiAccessScope,
      priceStars: AI_PACK_STARS_PRICE,
      subscription: serializeSubscription(sub),
    };
  }

  @Post("groups/:gid/ai-pack/invoice")
  async chatInvoice(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const ctx = getMiniappContext(req);
    const bot = { username: ctx.botUsername, token: ctx.botToken };
    await this.admin.assertGroupAdmin(gid, ctx.userId, bot);
    const chat = await this.admin.resolveChat(gid, bot);
    return this.createInvoice(
      "chat",
      chat.telegramChatId,
      bot.token,
      "Pack de IA para este grupo",
    );
  }

  @Post("groups/:gid/ai-pack/redeem-code")
  async chatRedeemCode(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: { code?: string },
  ) {
    const ctx = getMiniappContext(req);
    const bot = { username: ctx.botUsername, token: ctx.botToken };
    await this.admin.assertGroupAdmin(gid, ctx.userId, bot);
    const chat = await this.admin.resolveChat(gid, bot);
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!code) {
      throw new BadRequestException({ error: "invalid-code" });
    }
    const result = await this.aiAccess.redeemCode(
      BigInt(chat.telegramChatId),
      code,
    );
    if (!result.ok) {
      throw new BadRequestException({ error: result.reason });
    }
    return {
      scope: "chat" as AiAccessScope,
      priceStars: AI_PACK_STARS_PRICE,
      subscription: {
        active: true,
        canceled: false,
        currentPeriodEnd: result.expiresAt.toISOString(),
      },
    };
  }

  @Post("groups/:gid/ai-pack/cancel")
  async chatCancel(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const ctx = getMiniappContext(req);
    const bot = { username: ctx.botUsername, token: ctx.botToken };
    await this.admin.assertGroupAdmin(gid, ctx.userId, bot);
    const chat = await this.admin.resolveChat(gid, bot);
    return this.cancelSubscription(
      "chat",
      BigInt(chat.telegramChatId),
      bot.token,
    );
  }

  @Get("ai-pack/me")
  async userStatus(@Req() req: MiniappRequest) {
    const ctx = getMiniappContext(req);
    const sub = await this.aiAccess.getSubscription("user", BigInt(ctx.userId));
    return {
      scope: "user" as AiAccessScope,
      priceStars: AI_PACK_STARS_PRICE,
      subscription: serializeSubscription(sub),
    };
  }

  @Post("ai-pack/me/invoice")
  async userInvoice(@Req() req: MiniappRequest) {
    const ctx = getMiniappContext(req);
    return this.createInvoice(
      "user",
      ctx.userId,
      ctx.botToken,
      "Pack de IA personal",
    );
  }

  @Post("ai-pack/me/cancel")
  async userCancel(@Req() req: MiniappRequest) {
    const ctx = getMiniappContext(req);
    return this.cancelSubscription("user", BigInt(ctx.userId), ctx.botToken);
  }

  private async cancelSubscription(
    scope: AiAccessScope,
    targetId: bigint,
    token: string,
  ) {
    const sub = await this.aiAccess.getSubscription(scope, targetId);
    if (!sub) {
      throw new BadRequestException({ error: "no-subscription" });
    }
    const result = await this.aiAccess.cancelSubscription(scope, targetId);
    if (!result.ok) {
      throw new BadRequestException({ error: "cancel-failed" });
    }
    try {
      await this.gateway.editUserStarSubscription({
        userId: result.telegramUserId,
        telegramPaymentChargeId: result.lastChargeId,
        isCanceled: true,
        token,
      });
    } catch {
      // Our own record is already marked canceled; Telegram's side is best-effort.
    }
    return {
      scope,
      priceStars: AI_PACK_STARS_PRICE,
      subscription: {
        active: true,
        canceled: true,
        currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
      },
    };
  }

  private async createInvoice(
    scope: AiAccessScope,
    targetId: string,
    token: string,
    title: string,
  ) {
    const result = await this.gateway.createInvoiceLink({
      title,
      description:
        "IA real (Groq/Gemini/OpenRouter) durante 30 dias, se renueva automaticamente cada mes.",
      payload: `ai_pack:${scope}:${targetId}`,
      currency: "XTR",
      amount: AI_PACK_STARS_PRICE,
      subscriptionPeriodSeconds: AI_PACK_SUBSCRIPTION_PERIOD_SECONDS,
      token,
    });
    if (!result.ok || !result.url) {
      throw new BadRequestException({ error: "invoice-link-failed" });
    }
    return { url: result.url };
  }
}
