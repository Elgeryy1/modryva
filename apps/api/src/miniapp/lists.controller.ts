import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  PrismaFiltersRepository,
  PrismaFoundationRepository,
  PrismaGroupProtectionRepository,
} from "@superbot/data";
import { MiniappAdminService } from "./admin.service.js";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "./init-data.guard.js";

// Blocklist punishment applied when a trigger matches. Mirrors
// modules/security/src/blocklists.ts (BlocklistMode).
const BLOCKLIST_MODES = ["delete", "warn", "mute", "ban", "kick"] as const;
type BlocklistMode = (typeof BLOCKLIST_MODES)[number];
const isBlocklistMode = (value: unknown): value is BlocklistMode =>
  typeof value === "string" &&
  (BLOCKLIST_MODES as readonly string[]).includes(value);

// Trigger/response normalization mirrors the command parsers so entries created
// from the Mini App match the same messages the /addblocklist and /filter
// commands would (case-insensitive, whitespace-collapsed).
const normalizeBlocklistTrigger = (raw: string): string =>
  raw.trim().toLowerCase().replace(/\s+/gu, " ");
const normalizeFilterTrigger = (raw: string): string =>
  raw.trim().toLowerCase();

const MAX_TRIGGER_LEN = 256;
const MAX_REASON_LEN = 512;
const MAX_RESPONSE_LEN = 4096;

/**
 * List-shaped group-config sections that don't fit the single-config section
 * machinery: banned-word blocklists (entries + punishment mode) and
 * trigger→response filters. Same auth + audit contract as
 * {@link MiniappConfigController}: every route is admin-gated via
 * assertGroupAdmin + resolveChat, and writes record an audit event.
 *
 * The list `id` returned to the client is the entry's trigger — the natural
 * unique key per chat (repos key deletes by trigger, not by row id).
 */
@Controller("v1/miniapp")
@UseGuards(InitDataGuard)
export class MiniappListsController {
  private readonly protection = new PrismaGroupProtectionRepository();
  private readonly filters = new PrismaFiltersRepository();
  private readonly foundation = new PrismaFoundationRepository();

  // Explicit @Inject: tsx/esbuild does not emit decorator metadata.
  constructor(
    @Inject(MiniappAdminService) private readonly admin: MiniappAdminService,
  ) {}

  // --- Blocklist -----------------------------------------------------------

  @Get("groups/:gid/blocklist")
  async blocklist(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const chat = await this.authorize(req, gid);
    const [mode, entries] = await Promise.all([
      this.protection.getBlocklistMode(chat.chatId),
      this.protection.listBlocklist(chat.chatId),
    ]);
    return {
      mode,
      entries: entries.map((entry) => ({
        id: entry.trigger,
        trigger: entry.trigger,
        reason: entry.reason ?? null,
      })),
    };
  }

  @Put("groups/:gid/blocklist/mode")
  async setBlocklistMode(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const mode = (body as { mode?: unknown } | null)?.mode;
    if (!isBlocklistMode(mode)) {
      throw new BadRequestException({ error: "invalid-mode" });
    }
    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);
    await this.protection.setBlocklistMode(chat.tenantId, chat.chatId, mode);
    await this.audit(chat.tenantId, gid, ctx.userId, "blocklist.mode", {
      mode,
    });
    return { mode };
  }

  @Post("groups/:gid/blocklist/entries")
  async addBlocklistEntry(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const payload = (body ?? {}) as { trigger?: unknown; reason?: unknown };
    const trigger = normalizeBlocklistTrigger(
      typeof payload.trigger === "string" ? payload.trigger : "",
    );
    if (!trigger || trigger.length > MAX_TRIGGER_LEN) {
      throw new BadRequestException({ error: "invalid-trigger" });
    }
    const reasonRaw =
      typeof payload.reason === "string" ? payload.reason.trim() : "";
    if (reasonRaw.length > MAX_REASON_LEN) {
      throw new BadRequestException({ error: "invalid-reason" });
    }
    const reason = reasonRaw.length > 0 ? reasonRaw : undefined;

    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);
    await this.protection.addBlocklist(
      chat.tenantId,
      chat.chatId,
      trigger,
      reason,
    );
    await this.audit(chat.tenantId, gid, ctx.userId, "blocklist.add", {
      trigger,
    });
    return { id: trigger, trigger, reason: reason ?? null };
  }

  @Delete("groups/:gid/blocklist/entries/:id")
  async removeBlocklistEntry(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Param("id") id: string,
  ) {
    const trigger = normalizeBlocklistTrigger(decodeURIComponent(id));
    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);
    await this.protection.removeBlocklist(chat.chatId, trigger);
    await this.audit(chat.tenantId, gid, ctx.userId, "blocklist.remove", {
      trigger,
    });
    return { ok: true };
  }

  // --- Filters -------------------------------------------------------------

  @Get("groups/:gid/filters")
  async filterList(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const chat = await this.authorize(req, gid);
    const entries = await this.filters.listFilters(chat.chatId);
    return {
      entries: entries.map((entry) => ({
        id: entry.trigger,
        trigger: entry.trigger,
        response: entry.response,
      })),
    };
  }

  @Post("groups/:gid/filters")
  async addFilter(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const payload = (body ?? {}) as { trigger?: unknown; response?: unknown };
    const trigger = normalizeFilterTrigger(
      typeof payload.trigger === "string" ? payload.trigger : "",
    );
    if (!trigger || trigger.length > MAX_TRIGGER_LEN) {
      throw new BadRequestException({ error: "invalid-trigger" });
    }
    const response =
      typeof payload.response === "string" ? payload.response.trim() : "";
    if (!response || response.length > MAX_RESPONSE_LEN) {
      throw new BadRequestException({ error: "invalid-response" });
    }

    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);
    await this.filters.saveFilter(
      chat.tenantId,
      chat.chatId,
      trigger,
      response,
      ctx.userId,
    );
    await this.audit(chat.tenantId, gid, ctx.userId, "filter.add", { trigger });
    return { id: trigger, trigger, response };
  }

  @Delete("groups/:gid/filters/:id")
  async removeFilter(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Param("id") id: string,
  ) {
    const trigger = normalizeFilterTrigger(decodeURIComponent(id));
    const ctx = getMiniappContext(req);
    const chat = await this.authorize(req, gid);
    await this.filters.deleteFilter(chat.chatId, trigger);
    await this.audit(chat.tenantId, gid, ctx.userId, "filter.remove", {
      trigger,
    });
    return { ok: true };
  }

  // --- Shared --------------------------------------------------------------

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
