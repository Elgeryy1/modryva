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
  type AutomationAction,
  type AutomationCondition,
  type AutomationPatch,
  type AutomationRecord,
  type AutomationTrigger,
  PrismaAutomationRepository,
  PrismaFederationRepository,
} from "@superbot/data";
import { z } from "zod";
import { MiniappAdminService } from "./admin.service.js";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "./init-data.guard.js";

const triggerSchema: z.ZodType<AutomationTrigger> = z.discriminatedUnion(
  "kind",
  [
    z.object({
      kind: z.literal("contains_text"),
      text: z.string().min(1).max(256),
    }),
    z.object({ kind: z.literal("contains_link") }),
    z.object({ kind: z.literal("new_member") }),
    z.object({ kind: z.literal("report") }),
    z.object({ kind: z.literal("schedule"), cron: z.string().min(1).max(128) }),
    z.object({ kind: z.literal("high_risk") }),
  ],
);

const conditionSchema: z.ZodType<AutomationCondition> = z.discriminatedUnion(
  "kind",
  [
    z.object({ kind: z.literal("none") }),
    z.object({
      kind: z.literal("is_new_user"),
      maxAgeHours: z.number().int().positive().max(8760),
    }),
    z.object({
      kind: z.literal("not_in_chat"),
      telegramChatId: z.string().min(1),
    }),
    z.object({
      kind: z.literal("missing_badge"),
      badge: z.string().min(1).max(64),
    }),
    z.object({ kind: z.literal("source_chat"), chatId: z.string().min(1) }),
  ],
);

const actionSchema: z.ZodType<AutomationAction> = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("delete") }),
  z.object({ kind: z.literal("reply"), text: z.string().min(1).max(4096) }),
  z.object({ kind: z.literal("quarantine") }),
  z.object({
    kind: z.literal("notify_staff"),
    text: z.string().min(1).max(4096),
  }),
  z.object({ kind: z.literal("log"), text: z.string().min(1).max(4096) }),
  z
    .object({
      kind: z.literal("mute"),
      durationMs: z.number().int().positive().optional(),
    })
    .transform(({ kind, durationMs }) =>
      durationMs === undefined ? { kind } : { kind, durationMs },
    ),
  z.object({ kind: z.literal("webhook"), url: z.string().url().max(2048) }),
  z.object({
    kind: z.literal("assign_mission"),
    missionKind: z.string().min(1).max(64),
  }),
]);

const createSchema = z.object({
  name: z.string().min(1).max(64),
  trigger: triggerSchema,
  condition: conditionSchema,
  action: actionSchema,
  scope: z.enum(["chat", "network"]).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  trigger: triggerSchema.optional(),
  condition: conditionSchema.optional(),
  action: actionSchema.optional(),
  enabled: z.boolean().optional(),
});

// zod's `.optional()` yields `T | undefined` on present keys, but
// AutomationPatch requires exactOptionalPropertyTypes-clean fields (the key
// must be absent, not set to undefined) — drop absent-value keys before
// handing the patch to the repository.
const stripUndefined = (patch: {
  name?: string | undefined;
  trigger?: AutomationTrigger | undefined;
  condition?: AutomationCondition | undefined;
  action?: AutomationAction | undefined;
  enabled?: boolean | undefined;
}): AutomationPatch => ({
  ...(patch.name !== undefined ? { name: patch.name } : {}),
  ...(patch.trigger !== undefined ? { trigger: patch.trigger } : {}),
  ...(patch.condition !== undefined ? { condition: patch.condition } : {}),
  ...(patch.action !== undefined ? { action: patch.action } : {}),
  ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
});

const toApi = (row: AutomationRecord) => ({
  id: row.id,
  chatId: row.chatId,
  name: row.name,
  trigger: row.trigger,
  condition: row.condition,
  action: row.action,
  enabled: row.enabled,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

interface AuthorizedGroup {
  readonly chat: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly telegramChatId: string;
  };
  readonly fedId: string | null;
}

// Gate choice: assertGroupAdmin (same bar as every other /config section) is
// enough here — this is a per-group automations builder, not the network-wide
// owner-network console, so we don't require network-admin like routing/
// settings there do.
@Controller("v1/miniapp")
@UseGuards(InitDataGuard)
export class MiniappAutomationController {
  private readonly automations = new PrismaAutomationRepository();
  private readonly federation = new PrismaFederationRepository();

  constructor(
    @Inject(MiniappAdminService) private readonly admin: MiniappAdminService,
  ) {}

  @Get("groups/:gid/automations")
  async list(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const auth = await this.authorize(req, gid);
    if (!auth.fedId) {
      return { automations: [] };
    }
    const rows = await this.automations.list(auth.fedId, auth.chat.chatId);
    return { automations: rows.map(toApi) };
  }

  @Post("groups/:gid/automations")
  async create(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: "invalid-body" });
    }
    const auth = await this.authorize(req, gid);
    if (!auth.fedId) {
      throw new BadRequestException({ error: "not-in-network" });
    }
    const chatId = parsed.data.scope === "network" ? null : auth.chat.chatId;
    const row = await this.automations.create(
      auth.chat.tenantId,
      auth.fedId,
      chatId,
      parsed.data.name,
      parsed.data.trigger,
      parsed.data.condition,
      parsed.data.action,
    );
    return toApi(row);
  }

  @Put("groups/:gid/automations/:id")
  async update(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: "invalid-body" });
    }
    await this.authorizeOwning(req, gid, id);
    const updated = await this.automations.update(
      id,
      stripUndefined(parsed.data),
    );
    if (!updated) {
      throw new BadRequestException({ error: "not-found" });
    }
    return toApi(updated);
  }

  @Delete("groups/:gid/automations/:id")
  async remove(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Param("id") id: string,
  ) {
    await this.authorizeOwning(req, gid, id);
    const removed = await this.automations.remove(id);
    if (!removed) {
      throw new BadRequestException({ error: "not-found" });
    }
    return { ok: true };
  }

  @Post("groups/:gid/automations/:id/toggle")
  async toggle(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = z.object({ enabled: z.boolean() }).safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: "invalid-body" });
    }
    await this.authorizeOwning(req, gid, id);
    const ok = await this.automations.setEnabled(id, parsed.data.enabled);
    if (!ok) {
      throw new BadRequestException({ error: "not-found" });
    }
    return { ok: true };
  }

  private async authorize(
    req: MiniappRequest,
    gid: string,
  ): Promise<AuthorizedGroup> {
    const ctx = getMiniappContext(req);
    const bot = { username: ctx.botUsername, token: ctx.botToken };
    await this.admin.assertGroupAdmin(gid, ctx.userId, bot);
    const chat = await this.admin.resolveChat(gid, bot);
    const fed = await this.federation.getFederationForChat(chat.chatId);
    return { chat, fedId: fed?.fedId ?? null };
  }

  /**
   * Checks group-admin access AND that the automation actually belongs to
   * this group's network (or is scoped directly to this chat) before letting
   * an update/delete/toggle touch it — otherwise an admin of one group could
   * mutate another group's automation by guessing its id.
   */
  private async authorizeOwning(
    req: MiniappRequest,
    gid: string,
    id: string,
  ): Promise<AuthorizedGroup> {
    const auth = await this.authorize(req, gid);
    if (!auth.fedId) {
      throw new BadRequestException({ error: "not-in-network" });
    }
    const rows = await this.automations.list(auth.fedId, auth.chat.chatId);
    if (!rows.some((row) => row.id === id)) {
      throw new BadRequestException({ error: "not-found" });
    }
    return auth;
  }
}
