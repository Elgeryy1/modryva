import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
  PrismaFederationRepository,
  PrismaFoundationRepository,
} from "@superbot/data";
import { MiniappAdminService } from "./admin.service.js";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "./init-data.guard.js";

const MAX_NAME_LEN = 64;

/**
 * Federation membership for the CURRENT group (create/join/leave/status).
 * Mirrors the /newfed /joinfed /leavefed /chatfed chat commands
 * (modules/security/src/federations.ts, handleFederationCommand in
 * bot-update.service.ts) — same repository, same permission model: any group
 * admin can link/unlink their own group, but the joined-chats and ban LISTS
 * (like /fedexport) are only returned to the federation's owner/fed-admins.
 * Per-user ban ACTIONS (/fban, /fpromote, ...) are intentionally not exposed
 * here — those stay chat commands, matching how individual moderation actions
 * elsewhere are never Mini App config.
 */
@Controller("v1/miniapp")
@UseGuards(InitDataGuard)
export class MiniappFederationController {
  private readonly federation = new PrismaFederationRepository();
  private readonly foundation = new PrismaFoundationRepository();

  // Explicit @Inject: tsx/esbuild does not emit decorator metadata.
  constructor(
    @Inject(MiniappAdminService) private readonly admin: MiniappAdminService,
  ) {}

  @Get("groups/:gid/federation")
  async status(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const chat = await this.authorize(req, gid);
    const fed = await this.federation.getFederationForChat(chat.chatId);
    return this.view(fed, req, chat.tenantId);
  }

  @Post("groups/:gid/federation")
  async create(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const name = normalizeName((body as { name?: unknown } | null)?.name);
    if (!name) {
      throw new BadRequestException({ error: "invalid-name" });
    }
    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);

    const fedId = randomUUID();
    const fed = await this.federation.createFederation({
      tenantId: chat.tenantId,
      fedId,
      name,
      ownerTelegramId: BigInt(ctx.userId),
    });
    await this.federation.joinFederation(
      fedId,
      chat.chatId,
      BigInt(chat.telegramChatId),
    );
    await this.audit(chat.tenantId, gid, ctx.userId, "federation.create", {
      fedId,
      name,
    });
    return this.view(fed, req, chat.tenantId);
  }

  @Post("groups/:gid/federation/join")
  async join(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const fedId = (body as { fedId?: unknown } | null)?.fedId;
    if (typeof fedId !== "string" || fedId.trim().length === 0) {
      throw new BadRequestException({ error: "invalid-fed-id" });
    }
    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);

    const fed = await this.federation.getFederation(fedId.trim());
    if (!fed) {
      throw new BadRequestException({ error: "federation-not-found" });
    }
    await this.federation.joinFederation(
      fed.fedId,
      chat.chatId,
      BigInt(chat.telegramChatId),
    );
    await this.audit(chat.tenantId, gid, ctx.userId, "federation.join", {
      fedId: fed.fedId,
    });
    return this.view(fed, req, chat.tenantId);
  }

  @Delete("groups/:gid/federation")
  async leave(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);
    const left = await this.federation.leaveFederation(chat.chatId);
    if (left) {
      await this.audit(chat.tenantId, gid, ctx.userId, "federation.leave", {});
    }
    return { inFederation: false };
  }

  @Delete("groups/:gid/federation/bans/:userId")
  async unban(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Param("userId") userId: string,
  ) {
    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);
    const fed = await this.federation.getFederationForChat(chat.chatId);
    if (!fed) {
      throw new BadRequestException({ error: "not-in-federation" });
    }
    const isOwner = fed.ownerTelegramId === BigInt(ctx.userId);
    const isFedAdmin =
      isOwner ||
      (await this.federation.isFedAdmin(fed.fedId, BigInt(ctx.userId)));
    if (!isFedAdmin) {
      throw new ForbiddenException({ error: "not-fed-admin" });
    }
    let target: bigint;
    try {
      target = BigInt(userId);
    } catch {
      throw new BadRequestException({ error: "invalid-user-id" });
    }
    await this.federation.removeFedBan(fed.fedId, target);
    await this.audit(chat.tenantId, gid, ctx.userId, "federation.unban", {
      fedId: fed.fedId,
      target: userId,
    });
    return this.view(fed, req, chat.tenantId);
  }
  @Post("groups/:gid/federation/bans")
  async ban(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const payload = (body ?? {}) as { userId?: unknown; reason?: unknown };
    let target: bigint;
    try {
      target = BigInt(String(payload.userId ?? ""));
    } catch {
      throw new BadRequestException({ error: "invalid-user-id" });
    }
    const reason =
      typeof payload.reason === "string" && payload.reason.trim().length > 0
        ? payload.reason.trim().slice(0, 512)
        : undefined;

    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);
    const fed = await this.federation.getFederationForChat(chat.chatId);
    if (!fed) {
      throw new BadRequestException({ error: "not-in-federation" });
    }
    const userId = BigInt(ctx.userId);
    const isOwner = fed.ownerTelegramId === userId;
    const isFedAdmin =
      isOwner || (await this.federation.isFedAdmin(fed.fedId, userId));
    if (!isFedAdmin) {
      throw new ForbiddenException({ error: "not-fed-admin" });
    }
    if (target === fed.ownerTelegramId) {
      throw new BadRequestException({ error: "cannot-ban-owner" });
    }
    if (target === userId) {
      throw new BadRequestException({ error: "cannot-ban-self" });
    }
    if (!isOwner && (await this.federation.isFedAdmin(fed.fedId, target))) {
      throw new BadRequestException({ error: "cannot-ban-fed-admin" });
    }

    await this.federation.addFedBan({
      fedId: fed.fedId,
      subjectTelegramId: target,
      reason,
      actorTelegramId: userId,
    });
    await this.audit(chat.tenantId, gid, ctx.userId, "federation.ban", {
      fedId: fed.fedId,
      target: target.toString(),
    });
    return this.view(fed, req, chat.tenantId);
  }
  @Post("groups/:gid/federation/admins")
  async addAdmin(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    let target: bigint;
    try {
      target = BigInt(
        String((body as { userId?: unknown } | null)?.userId ?? ""),
      );
    } catch {
      throw new BadRequestException({ error: "invalid-user-id" });
    }
    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);
    const fed = await this.federation.getFederationForChat(chat.chatId);
    if (!fed) {
      throw new BadRequestException({ error: "not-in-federation" });
    }
    if (fed.ownerTelegramId !== BigInt(ctx.userId)) {
      throw new ForbiddenException({ error: "not-owner" });
    }
    await this.federation.addFedAdmin(fed.fedId, target);
    await this.audit(chat.tenantId, gid, ctx.userId, "federation.admin.add", {
      fedId: fed.fedId,
      target: target.toString(),
    });
    return this.view(fed, req, chat.tenantId);
  }

  @Delete("groups/:gid/federation/admins/:userId")
  async removeAdmin(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Param("userId") userId: string,
  ) {
    let target: bigint;
    try {
      target = BigInt(userId);
    } catch {
      throw new BadRequestException({ error: "invalid-user-id" });
    }
    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);
    const fed = await this.federation.getFederationForChat(chat.chatId);
    if (!fed) {
      throw new BadRequestException({ error: "not-in-federation" });
    }
    if (fed.ownerTelegramId !== BigInt(ctx.userId)) {
      throw new ForbiddenException({ error: "not-owner" });
    }
    await this.federation.removeFedAdmin(fed.fedId, target);
    await this.audit(
      chat.tenantId,
      gid,
      ctx.userId,
      "federation.admin.remove",
      {
        fedId: fed.fedId,
        target: userId,
      },
    );
    return this.view(fed, req, chat.tenantId);
  }
  @Post("groups/:gid/federation/rename")
  async rename(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const name = normalizeName((body as { name?: unknown } | null)?.name);
    if (!name) {
      throw new BadRequestException({ error: "invalid-name" });
    }
    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);
    const fed = await this.federation.getFederationForChat(chat.chatId);
    if (!fed) {
      throw new BadRequestException({ error: "not-in-federation" });
    }
    if (fed.ownerTelegramId !== BigInt(ctx.userId)) {
      throw new ForbiddenException({ error: "not-owner" });
    }
    await this.federation.renameFederation(fed.fedId, name);
    await this.audit(chat.tenantId, gid, ctx.userId, "federation.rename", {
      fedId: fed.fedId,
      name,
    });
    const renamed = await this.federation.getFederation(fed.fedId);
    return this.view(renamed, req, chat.tenantId);
  }

  @Delete("groups/:gid/federation/all")
  async deleteEntirely(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);
    const fed = await this.federation.getFederationForChat(chat.chatId);
    if (!fed) {
      throw new BadRequestException({ error: "not-in-federation" });
    }
    if (fed.ownerTelegramId !== BigInt(ctx.userId)) {
      throw new ForbiddenException({ error: "not-owner" });
    }
    await this.federation.deleteFederation(fed.fedId);
    await this.audit(chat.tenantId, gid, ctx.userId, "federation.delete", {
      fedId: fed.fedId,
    });
    return { inFederation: false };
  }
  @Post("groups/:gid/federation/subscription")
  async setSubscription(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const targetFedId = (body as { fedId?: unknown } | null)?.fedId;
    if (typeof targetFedId !== "string" || targetFedId.trim().length === 0) {
      throw new BadRequestException({ error: "invalid-fed-id" });
    }
    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);
    const fed = await this.federation.getFederationForChat(chat.chatId);
    if (!fed) {
      throw new BadRequestException({ error: "not-in-federation" });
    }
    if (fed.ownerTelegramId !== BigInt(ctx.userId)) {
      throw new ForbiddenException({ error: "not-owner" });
    }
    const parent = await this.federation.getFederation(targetFedId.trim());
    if (!parent) {
      throw new BadRequestException({ error: "federation-not-found" });
    }
    await this.federation.setSubscribedFed(fed.fedId, parent.fedId);
    await this.audit(chat.tenantId, gid, ctx.userId, "federation.subscribe", {
      fedId: fed.fedId,
      subscribedFedId: parent.fedId,
    });
    const updated = await this.federation.getFederation(fed.fedId);
    return this.view(updated, req, chat.tenantId);
  }

  @Delete("groups/:gid/federation/subscription")
  async clearSubscription(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
  ) {
    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);
    const fed = await this.federation.getFederationForChat(chat.chatId);
    if (!fed) {
      throw new BadRequestException({ error: "not-in-federation" });
    }
    if (fed.ownerTelegramId !== BigInt(ctx.userId)) {
      throw new ForbiddenException({ error: "not-owner" });
    }
    await this.federation.setSubscribedFed(fed.fedId, null);
    await this.audit(chat.tenantId, gid, ctx.userId, "federation.unsubscribe", {
      fedId: fed.fedId,
    });
    const updated = await this.federation.getFederation(fed.fedId);
    return this.view(updated, req, chat.tenantId);
  }

  private async view(
    fed: FederationRecord | null,
    req: MiniappRequest,
    tenantId: string,
  ) {
    if (!fed) {
      return { inFederation: false as const };
    }
    const ctx = getMiniappContext(req);
    const userId = BigInt(ctx.userId);
    const isOwner = fed.ownerTelegramId === userId;
    const [chatCount, banCount, adminCount, isFedAdmin] = await Promise.all([
      this.federation.countFedChats(fed.fedId),
      this.federation.countFedBans(fed.fedId),
      this.federation.countFedAdmins(fed.fedId),
      isOwner
        ? Promise.resolve(true)
        : this.federation.isFedAdmin(fed.fedId, userId),
    ]);

    // The joined-chat and ban lists are only for fed admins/owner — same
    // sensitivity as /fedexport and /fban in the chat commands, never shown to
    // a plain group admin who merely linked their chat.
    const [chats, bans, admins] = isFedAdmin
      ? await Promise.all([
          this.federation.listFederationChats(fed.fedId),
          this.federation.listFedBans(fed.fedId),
          this.federation.listFedAdmins(fed.fedId),
        ])
      : [undefined, undefined, undefined];

    // Titles are best-effort: a chat only has one once the bot has seen it
    // (its Chat row created by ensureContext). Falls back to the raw id.
    const chatsWithTitle = chats
      ? await Promise.all(
          chats.map(async (c) => {
            const resolved = await this.foundation.findChatByTelegramId(
              tenantId,
              c.telegramChatId,
            );
            return {
              telegramChatId: c.telegramChatId.toString(),
              title: resolved?.title ?? null,
            };
          }),
        )
      : undefined;

    return {
      inFederation: true as const,
      fedId: fed.fedId,
      name: fed.name,
      ownerTelegramId: fed.ownerTelegramId.toString(),
      isOwner,
      isFedAdmin,
      chatCount,
      banCount,
      adminCount,
      subscribedFedId: fed.subscribedFedId ?? null,
      ...(chatsWithTitle ? { chats: chatsWithTitle } : {}),
      ...(bans
        ? {
            bans: bans.map((b) => ({
              telegramUserId: b.subjectTelegramId.toString(),
              reason: b.reason ?? null,
            })),
          }
        : {}),
      ...(admins ? { admins: admins.map((id) => id.toString()) } : {}),
    };
  }

  private async authorize(req: MiniappRequest, gid: string) {
    const ctx = getMiniappContext(req);
    const bot = { username: ctx.botUsername, token: ctx.botToken };
    await this.admin.assertGroupAdmin(gid, ctx.userId, bot);
    return this.admin.resolveChat(gid, bot);
  }

  private async audit(
    tenantId: string,
    gid: string,
    telegramUserId: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.foundation.recordAudit({
      tenantId,
      actorType: "user",
      action: `miniapp.${action}`,
      resourceType: "chat_settings",
      resourceId: gid,
      payload: { ...payload, source: "miniapp", telegramUserId },
    });
  }
}

const normalizeName = (raw: unknown): string | null => {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_NAME_LEN ? trimmed : null;
};
