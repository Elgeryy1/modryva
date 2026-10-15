import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  PrismaFoundationRepository,
  PrismaTicketRepository,
  type TicketRecord,
} from "@superbot/data";
import { z } from "zod";
import { MiniappAdminService } from "./admin.service.js";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "./init-data.guard.js";

// Statuses an admin can set from the Mini App. "assigned" is reached via the
// assign endpoint, not here; "open" doubles as reopen.
const SETTABLE_STATUSES = ["open", "resolved", "closed"] as const;
const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const statusSchema = z.object({ status: z.enum(SETTABLE_STATUSES) });
const prioritySchema = z.object({ priority: z.enum(TICKET_PRIORITIES) });
const assignSchema = z.object({ assigneeTelegramId: z.string().min(1) });

interface TicketView {
  readonly id: string;
  readonly number: number;
  readonly subject: string;
  readonly status: string;
  readonly priority: string;
  readonly assigneeTelegramId: string | null;
  readonly reporterTelegramId: string;
  readonly createdAt: string;
}

const toView = (ticket: TicketRecord): TicketView => ({
  id: ticket.id,
  number: ticket.number,
  subject: ticket.subject,
  status: ticket.status,
  priority: ticket.priority,
  assigneeTelegramId: ticket.assigneeTelegramId?.toString() ?? null,
  reporterTelegramId: ticket.reporterTelegramId.toString(),
  createdAt: ticket.createdAt.toISOString(),
});

/**
 * Dedicated support-ticket admin surface for the Mini App. The chat keeps
 * `/ticket` for OPENING tickets; viewing, resolving, closing, reopening,
 * assigning and re-prioritising all happen here. Scoped to the single group the
 * admin opened `/config` for (matching the chat command's per-chat scope), NOT
 * the whole network — that broader view stays in the moderation inbox.
 *
 * Auth mirrors every other Mini App admin controller: the live Telegram admin
 * list is the only source of truth (fail-closed), verified per request by
 * {@link MiniappAdminService.assertGroupAdmin}. Every mutation additionally
 * confirms the ticket belongs to THIS chat, so an admin of one group can't touch
 * another group's ticket that happens to share the tenant.
 */
@Controller("v1/miniapp")
@UseGuards(InitDataGuard)
export class MiniappTicketsController {
  private readonly tickets = new PrismaTicketRepository();
  private readonly foundation = new PrismaFoundationRepository();

  constructor(
    @Inject(MiniappAdminService) private readonly admin: MiniappAdminService,
  ) {}

  @Get("groups/:gid/tickets")
  async list(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Query("scope") scope?: string,
  ) {
    const auth = await this.authorize(req, gid);
    const tickets =
      scope === "all"
        ? await this.tickets.listRecent(auth.chat.tenantId, auth.chat.chatId)
        : await this.tickets.listOpen(auth.chat.tenantId, auth.chat.chatId);
    return { tickets: tickets.map(toView) };
  }

  @Get("groups/:gid/tickets/:id")
  async detail(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Param("id") id: string,
  ) {
    const auth = await this.authorize(req, gid);
    const ticket = await this.loadScoped(auth, id);
    return { ticket: toView(ticket) };
  }

  @Post("groups/:gid/tickets/:id/status")
  async setStatus(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: "invalid-status" });
    }
    const auth = await this.authorize(req, gid);
    const ticket = await this.loadScoped(auth, id);
    await this.tickets.setStatus(ticket.id, parsed.data.status);
    await this.audit(auth, gid, ticket, "miniapp.ticket.status", {
      status: parsed.data.status,
    });
    return { ok: true };
  }

  @Post("groups/:gid/tickets/:id/priority")
  async setPriority(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = prioritySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: "invalid-priority" });
    }
    const auth = await this.authorize(req, gid);
    const ticket = await this.loadScoped(auth, id);
    await this.tickets.setPriority(ticket.id, parsed.data.priority);
    await this.audit(auth, gid, ticket, "miniapp.ticket.priority", {
      priority: parsed.data.priority,
    });
    return { ok: true };
  }

  @Post("groups/:gid/tickets/:id/assign")
  async assign(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = assignSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: "missing-assignee" });
    }
    let assignee: bigint;
    try {
      assignee = BigInt(parsed.data.assigneeTelegramId);
    } catch {
      throw new BadRequestException({ error: "invalid-assignee" });
    }
    const auth = await this.authorize(req, gid);
    const ticket = await this.loadScoped(auth, id);
    await this.tickets.assign(ticket.id, assignee);
    await this.audit(auth, gid, ticket, "miniapp.ticket.assign", {
      assignee: assignee.toString(),
    });
    return { ok: true };
  }

  /**
   * Load a ticket and prove it belongs to the caller's chat. getTicket scopes by
   * tenant; the chatId check narrows it to the exact group the admin authorized
   * against, so a shared-tenant ticket from another group is invisible (404).
   */
  private async loadScoped(
    auth: AuthorizedTickets,
    id: string,
  ): Promise<TicketRecord> {
    const ticket = await this.tickets.getTicket(auth.chat.tenantId, id);
    if (!ticket || ticket.chatId !== auth.chat.chatId) {
      throw new NotFoundException({ error: "ticket-not-found" });
    }
    return ticket;
  }

  private async audit(
    auth: AuthorizedTickets,
    gid: string,
    ticket: TicketRecord,
    action: string,
    extra: Record<string, unknown>,
  ): Promise<void> {
    await this.foundation.recordAudit({
      tenantId: auth.chat.tenantId,
      actorType: "user",
      action,
      resourceType: "ticket",
      resourceId: ticket.id,
      payload: {
        gid,
        number: ticket.number,
        source: "miniapp",
        telegramUserId: auth.telegramUserId,
        ...extra,
      },
    });
  }

  private async authorize(
    req: MiniappRequest,
    gid: string,
  ): Promise<AuthorizedTickets> {
    const ctx = getMiniappContext(req);
    const bot = { username: ctx.botUsername, token: ctx.botToken };
    await this.admin.assertGroupAdmin(gid, ctx.userId, bot);
    const chat = await this.admin.resolveChat(gid, bot);
    return { chat, telegramUserId: ctx.userId };
  }
}

interface AuthorizedTickets {
  readonly chat: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly telegramChatId: string;
    readonly title?: string | undefined;
  };
  readonly telegramUserId: string;
}
