import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  INTERNAL_ROLES,
  type InternalRole,
  PrismaFederationRepository,
  PrismaInternalRoleRepository,
  PrismaModerationExtraRepository,
  PrismaOwnerNetworkRiskRepository,
} from "@superbot/data";
import { z } from "zod";
import { MiniappAdminService } from "./admin.service.js";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "./init-data.guard.js";

const telegramUserIdSchema = z.string().regex(/^\d+$/u);

const roleSchema = z.object({
  role: z.enum(INTERNAL_ROLES),
});

const noteSchema = z.object({
  note: z.string().min(1).max(2000),
});

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

@Controller("v1/miniapp")
@UseGuards(InitDataGuard)
export class MiniappUserPanelController {
  private readonly federation = new PrismaFederationRepository();
  private readonly moderationExtra = new PrismaModerationExtraRepository();
  private readonly internalRole = new PrismaInternalRoleRepository();
  private readonly risk = new PrismaOwnerNetworkRiskRepository();

  constructor(
    @Inject(MiniappAdminService) private readonly admin: MiniappAdminService,
  ) {}

  @Get("groups/:gid/users/:telegramUserId")
  async profile(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Param("telegramUserId") telegramUserId: string,
  ) {
    const parsedId = telegramUserIdSchema.safeParse(telegramUserId);
    if (!parsedId.success) {
      throw new BadRequestException({ error: "invalid-telegram-user-id" });
    }
    const auth = await this.authorize(req, gid);
    const subjectTelegramUserId = BigInt(telegramUserId);
    const fed = await this.federation.getFederationForChat(auth.chat.chatId);
    const isOwner = fed ? fed.ownerTelegramId === auth.userId : false;

    // The chats this admin may see reports from: their own chat, plus the whole
    // federation network if this chat belongs to one. Reports are stored at
    // TENANT scope (one bot can serve many unrelated groups), so without this the
    // subject filter below returned reports about the user from OTHER chats of the
    // same bot — groups this admin has no relationship to — a cross-chat leak.
    const federationChats = fed
      ? await this.federation.listFederationChats(fed.fedId)
      : [];
    const allowedChatIds = new Set<string>([
      auth.chat.chatId,
      ...federationChats.map((chat) => chat.chatId),
    ]);

    const [warnings, reports, notes] = await Promise.all([
      this.moderationExtra.listActiveWarnings(
        auth.chat.tenantId,
        auth.chat.chatId,
        subjectTelegramUserId,
        20,
      ),
      this.moderationExtra.listReports({
        tenantId: auth.chat.tenantId,
        limit: 200,
      }),
      fed
        ? this.internalRole.listNotes(fed.fedId, subjectTelegramUserId, 20)
        : Promise.resolve([]),
    ]);
    const reportsForSubject = reports.filter(
      (report) =>
        report.subjectTelegramId === subjectTelegramUserId &&
        // Chat-less (tenant-global) reports aren't tied to a specific group, so
        // they don't leak another chat's context; scoped reports must be in view.
        (!report.chatId || allowedChatIds.has(report.chatId)),
    );

    const networkChats = fed
      ? federationChats.map((chat) => ({
          chatId: chat.chatId,
          telegramChatId: chat.telegramChatId.toString(),
        }))
      : undefined;

    // El rol interno solo controla el acceso al panel de la Mini App; nunca
    // sustituye a ser admin real de Telegram para acciones como banear o mutear.
    const internalRole = fed
      ? await this.internalRole.getRole(fed.fedId, subjectTelegramUserId)
      : null;

    const risk = fed
      ? await this.risk.getProfile(fed.fedId, subjectTelegramUserId)
      : null;

    return {
      telegramUserId,
      inNetwork: Boolean(fed),
      networkChats,
      warnings: warnings.map((warning) => ({
        reason: warning.reason,
        createdAt: warning.createdAt.toISOString(),
      })),
      reports: reportsForSubject.map((report) => ({
        id: report.id,
        chatId: report.chatId ?? null,
        reason: report.reason ?? null,
        status: report.status,
        createdAt: report.createdAt.toISOString(),
      })),
      sanctions: undefined,
      notes: notes.map((note) => ({
        id: note.id,
        authorTelegramUserId: note.authorTelegramUserId.toString(),
        note: note.note,
        createdAt: note.createdAt.toISOString(),
      })),
      internalRole,
      canManageRole: isOwner,
      risk: risk
        ? {
            score: risk.score,
            deletedCount: risk.deletedCount,
            reportCount: risk.reportCount,
            quarantineCount: risk.quarantineCount,
            linkCount: risk.linkCount,
            sanctionCount: risk.sanctionCount,
          }
        : null,
      badges: undefined,
    };
  }

  @Put("groups/:gid/users/:telegramUserId/role")
  async setRole(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Param("telegramUserId") telegramUserId: string,
    @Body() body: unknown,
  ) {
    const parsedId = telegramUserIdSchema.safeParse(telegramUserId);
    if (!parsedId.success) {
      throw new BadRequestException({ error: "invalid-telegram-user-id" });
    }
    const parsedBody = roleSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new BadRequestException({ error: "invalid-body" });
    }

    const auth = await this.authorize(req, gid);
    const fed = await this.federation.getFederationForChat(auth.chat.chatId);
    if (!fed) {
      throw new BadRequestException({ error: "not-in-network" });
    }
    const isOwner = fed.ownerTelegramId === auth.userId;
    if (!isOwner) {
      throw new ForbiddenException({ error: "not-network-owner" });
    }

    const subjectTelegramUserId = BigInt(telegramUserId);
    const role: InternalRole = parsedBody.data.role;
    await this.internalRole.setRole(
      auth.chat.tenantId,
      fed.fedId,
      subjectTelegramUserId,
      role,
    );
    return { telegramUserId, role };
  }

  @Post("groups/:gid/users/:telegramUserId/notes")
  async addNote(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Param("telegramUserId") telegramUserId: string,
    @Body() body: unknown,
  ) {
    const parsedId = telegramUserIdSchema.safeParse(telegramUserId);
    if (!parsedId.success) {
      throw new BadRequestException({ error: "invalid-telegram-user-id" });
    }
    const parsedBody = noteSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new BadRequestException({ error: "invalid-body" });
    }

    const auth = await this.authorize(req, gid);
    const fed = await this.federation.getFederationForChat(auth.chat.chatId);
    if (!fed) {
      throw new BadRequestException({ error: "not-in-network" });
    }

    const created = await this.internalRole.addNote({
      tenantId: auth.chat.tenantId,
      fedId: fed.fedId,
      subjectTelegramUserId: BigInt(telegramUserId),
      authorTelegramUserId: auth.userId,
      note: parsedBody.data.note,
    });
    return {
      telegramUserId,
      id: created.id,
      note: created.note,
      createdAt: created.createdAt.toISOString(),
      persisted: true as const,
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
}
