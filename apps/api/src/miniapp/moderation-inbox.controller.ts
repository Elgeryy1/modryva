import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  PrismaD1Repository,
  PrismaFederationRepository,
  PrismaFoundationRepository,
  PrismaModerationExtraRepository,
  PrismaTicketRepository,
} from "@superbot/data";
import { z } from "zod";
import { MiniappAdminService } from "./admin.service.js";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "./init-data.guard.js";

const INBOX_KINDS = ["report", "quarantine", "appeal", "ticket"] as const;
type InboxKind = (typeof INBOX_KINDS)[number];

const RESOLVE_ACTIONS = ["approve", "reject", "close", "assign"] as const;
type ResolveAction = (typeof RESOLVE_ACTIONS)[number];

const resolveBodySchema = z.object({
  action: z.enum(RESOLVE_ACTIONS),
  assigneeTelegramId: z.string().min(1).optional(),
});

interface InboxItem {
  readonly id: string;
  readonly kind: InboxKind;
  readonly chatId: string;
  readonly subjectTelegramId?: string;
  readonly reason?: string;
  readonly priority?: string;
  readonly status: string;
  readonly createdAt: string;
}

/**
 * Cross-chat moderation inbox: aggregates reports, cuarentena pendiente,
 * apelaciones abiertas y tickets abiertos de todos los chats de la red del
 * grupo (o solo del propio chat si no hay red). Ver: solo admin del grupo
 * llamante. Resolver: mismo gate, ya que el rol de admin ya viene verificado
 * en vivo contra Telegram por MiniappAdminService.
 */
@Controller("v1/miniapp")
@UseGuards(InitDataGuard)
export class MiniappModerationInboxController {
  private readonly d1 = new PrismaD1Repository();
  private readonly federation = new PrismaFederationRepository();
  private readonly foundation = new PrismaFoundationRepository();
  private readonly moderationExtra = new PrismaModerationExtraRepository();
  private readonly tickets = new PrismaTicketRepository();

  constructor(
    @Inject(MiniappAdminService) private readonly admin: MiniappAdminService,
  ) {}

  @Get("groups/:gid/moderation/inbox")
  async list(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Query("chatId") chatIdFilter?: string,
    @Query("kind") kindFilter?: string,
    @Query("status") statusFilter?: string,
  ) {
    const auth = await this.authorize(req, gid);
    if (kindFilter && !INBOX_KINDS.includes(kindFilter as InboxKind)) {
      throw new BadRequestException({ error: "invalid-kind" });
    }

    const chatIds = await this.networkChatIds(
      auth.chat.tenantId,
      auth.chat.chatId,
    );
    const scopedChatIds = chatIdFilter
      ? chatIds.filter((id) => id === chatIdFilter)
      : chatIds;

    const items = await this.collectItems(auth.chat.tenantId, scopedChatIds);
    const filtered = items.filter(
      (item) =>
        (!kindFilter || item.kind === kindFilter) &&
        (!statusFilter || item.status === statusFilter),
    );
    filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return { items: filtered, chatIds };
  }

  @Post("groups/:gid/moderation/inbox/:kind/:id/resolve")
  async resolve(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Param("kind") kindParam: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    if (!INBOX_KINDS.includes(kindParam as InboxKind)) {
      throw new BadRequestException({ error: "invalid-kind" });
    }
    const kind = kindParam as InboxKind;
    const parsed = resolveBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: "invalid-body" });
    }

    const auth = await this.authorize(req, gid);
    const chatIds = await this.networkChatIds(
      auth.chat.tenantId,
      auth.chat.chatId,
    );

    // Authorize BEFORE mutating. dispatchResolve mutated by id alone: report and
    // ticket never consulted allowedChatIds at all, and quarantine/appeal mutated
    // FIRST and only checked scope afterwards (the cross-tenant write persisted
    // even though the caller got an error) — a cross-tenant IDOR on every kind.
    // Requiring the target to already appear in THIS caller's tenant + network
    // scoped inbox closes all four at once and reuses the exact scoped queries the
    // list endpoint is built on. Reusing the generic "resolve-failed" (rather than
    // a distinct "forbidden") is deliberate: it must not become an oracle telling
    // an attacker whether an id exists inside some other tenant.
    const scoped = await this.collectItems(auth.chat.tenantId, chatIds);
    if (!scoped.some((item) => item.kind === kind && item.id === id)) {
      throw new BadRequestException({ error: "resolve-failed" });
    }

    const ok = await this.dispatchResolve(kind, id, parsed.data, chatIds);
    if (!ok) {
      throw new BadRequestException({ error: "resolve-failed" });
    }

    await this.foundation.recordAudit({
      tenantId: auth.chat.tenantId,
      actorType: "user",
      action: "miniapp.moderation.inbox.resolve",
      resourceType: "chat_settings",
      resourceId: gid,
      payload: {
        kind,
        id,
        action: parsed.data.action,
        source: "miniapp",
        telegramUserId: auth.telegramUserId,
      },
    });

    return { ok: true };
  }

  private async dispatchResolve(
    kind: InboxKind,
    id: string,
    input: z.infer<typeof resolveBodySchema>,
    allowedChatIds: readonly string[],
  ): Promise<boolean> {
    switch (kind) {
      case "report":
        return this.moderationExtra.resolveReport(
          id,
          reportStatusFor(input.action),
        );
      case "quarantine": {
        const status = input.action === "approve" ? "approved" : "rejected";
        const resolved = await this.d1.resolveQuarantineItem(
          id,
          status,
          undefined,
          undefined,
        );
        return resolved !== null && allowedChatIds.includes(resolved.chatId);
      }
      case "appeal": {
        const status = input.action === "approve" ? "accepted" : "denied";
        const resolved = await this.d1.resolveAppeal(
          id,
          status,
          undefined,
          undefined,
        );
        return (
          resolved !== null &&
          (resolved.chatId === undefined ||
            allowedChatIds.includes(resolved.chatId))
        );
      }
      case "ticket": {
        if (input.action === "assign") {
          if (!input.assigneeTelegramId) {
            throw new BadRequestException({ error: "missing-assignee" });
          }
          let assignee: bigint;
          try {
            assignee = BigInt(input.assigneeTelegramId);
          } catch {
            throw new BadRequestException({ error: "invalid-assignee" });
          }
          await this.tickets.assign(id, assignee);
          return true;
        }
        const status = input.action === "approve" ? "resolved" : "closed";
        await this.tickets.setStatus(id, status);
        return true;
      }
      default:
        return false;
    }
  }

  private async collectItems(
    tenantId: string,
    chatIds: readonly string[],
  ): Promise<InboxItem[]> {
    const items: InboxItem[] = [];

    const reports = await this.moderationExtra.listReports({ tenantId });
    for (const report of reports) {
      if (report.chatId && !chatIds.includes(report.chatId)) {
        continue;
      }
      items.push({
        id: report.id,
        kind: "report",
        chatId: report.chatId ?? "",
        subjectTelegramId: report.subjectTelegramId.toString(),
        ...(report.reason !== undefined ? { reason: report.reason } : {}),
        status: report.status,
        createdAt: report.createdAt.toISOString(),
      });
    }

    for (const chatId of chatIds) {
      const quarantineItems = await this.d1.listPendingQuarantine(chatId);
      for (const q of quarantineItems) {
        items.push({
          id: q.id,
          kind: "quarantine",
          chatId: q.chatId,
          subjectTelegramId: q.actorTelegramId.toString(),
          reason: q.reason,
          status: q.status,
          createdAt: q.createdAt.toISOString(),
        });
      }

      const tickets = await this.tickets.listOpen(tenantId, chatId);
      for (const ticket of tickets) {
        items.push({
          id: ticket.id,
          kind: "ticket",
          chatId,
          reason: ticket.subject,
          priority: ticket.priority,
          status: ticket.status,
          createdAt: ticket.createdAt.toISOString(),
        });
      }
    }

    const appealChatIds: (string | undefined)[] =
      chatIds.length > 0 ? [...chatIds] : [undefined];
    const seenAppealIds = new Set<string>();
    for (const chatId of appealChatIds) {
      const appeals = await this.d1.listOpenAppeals(tenantId, chatId);
      for (const appeal of appeals) {
        if (seenAppealIds.has(appeal.id)) {
          continue;
        }
        seenAppealIds.add(appeal.id);
        items.push({
          id: appeal.id,
          kind: "appeal",
          chatId: appeal.chatId ?? "",
          subjectTelegramId: appeal.appellantTelegramId.toString(),
          reason: appeal.message,
          status: appeal.status,
          createdAt: appeal.createdAt.toISOString(),
        });
      }
    }

    return items;
  }

  private async networkChatIds(
    tenantId: string,
    ownChatId: string,
  ): Promise<string[]> {
    void tenantId;
    const fed = await this.federation.getFederationForChat(ownChatId);
    if (!fed) {
      return [ownChatId];
    }
    const chats = await this.federation.listFederationChats(fed.fedId);
    const ids = chats.map((chat) => chat.chatId);
    return ids.includes(ownChatId) ? ids : [ownChatId, ...ids];
  }

  private async authorize(
    req: MiniappRequest,
    gid: string,
  ): Promise<AuthorizedInbox> {
    const ctx = getMiniappContext(req);
    const bot = { username: ctx.botUsername, token: ctx.botToken };
    await this.admin.assertGroupAdmin(gid, ctx.userId, bot);
    const chat = await this.admin.resolveChat(gid, bot);
    return { chat, gid, telegramUserId: ctx.userId };
  }
}

interface AuthorizedInbox {
  readonly chat: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly telegramChatId: string;
    readonly title?: string | undefined;
  };
  readonly gid: string;
  readonly telegramUserId: string;
}

const reportStatusFor = (action: ResolveAction): string => {
  switch (action) {
    case "approve":
      return "resolved";
    case "reject":
      return "dismissed";
    case "close":
      return "closed";
    case "assign":
      return "assigned";
  }
};
