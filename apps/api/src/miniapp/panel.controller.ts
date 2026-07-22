import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  PrismaChatSettingRepository,
  PrismaFoundationRepository,
} from "@superbot/data";
import {
  BOT_VOICES,
  DEFAULT_DOCK,
  DEFAULT_MODULE_NAMES,
  DENSITY_MODES,
  isBotVoice,
  isDensityMode,
  resolveDock,
  resolveModuleName,
  sanitizeModuleName,
  toggleFavorite,
} from "@superbot/module-community";
import { z } from "zod";
import { MiniappAdminService } from "./admin.service.js";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "./init-data.guard.js";

const DOCK_KEY = "dock_order";
const MODULE_NAMES_KEY = "module_names";
const DENSITY_KEY = "density_mode";
const VOICE_KEY = "bot_voice";
const DEFAULT_VOICE = "serio";

const dockSchema = z.object({ id: z.string().min(1) });
const moduleNameSchema = z.object({
  key: z.string().min(1),
  name: z.string().optional(),
});
const densitySchema = z.object({ mode: z.string().min(1) });
const voiceSchema = z.object({ voice: z.string().min(1) });

const asStringArray = (raw: unknown): string[] =>
  Array.isArray(raw)
    ? raw.filter((v): v is string => typeof v === "string")
    : [];

const asStringRecord = (raw: unknown): Record<string, string> =>
  raw && typeof raw === "object" ? (raw as Record<string, string>) : {};

const moduleNameViews = (overrides: Record<string, string>) =>
  Object.keys(DEFAULT_MODULE_NAMES).map((key) => ({
    key,
    default: DEFAULT_MODULE_NAMES[key] ?? key,
    current: resolveModuleName(key, overrides),
  }));

/**
 * Panel personalization surfaced in the Mini App: the config that today lives
 * only in chat commands (/dock, /nombres, /densidad, /voz) but shapes the Mini
 * App itself. Reads/writes the same per-chat ChatSetting keys the chat handlers
 * use, and reuses their exact pure helpers, so both surfaces agree. Admin-gated
 * like the rest of /config (density, per-user in chat, is set for the calling
 * admin here).
 */
@Controller("v1/miniapp")
@UseGuards(InitDataGuard)
export class MiniappPanelController {
  private readonly settings = new PrismaChatSettingRepository();
  private readonly foundation = new PrismaFoundationRepository();

  constructor(
    @Inject(MiniappAdminService) private readonly admin: MiniappAdminService,
  ) {}

  @Get("groups/:gid/panel")
  async get(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const auth = await this.authorize(req, gid);
    const { tenantId, chatId } = auth.chat;

    const [dockRaw, namesRaw, densityRaw, voiceRaw] = await Promise.all([
      this.settings.getValue(tenantId, chatId, DOCK_KEY),
      this.settings.getValue(tenantId, chatId, MODULE_NAMES_KEY),
      this.settings.getValue(tenantId, chatId, DENSITY_KEY),
      this.settings.getValue(tenantId, chatId, VOICE_KEY),
    ]);

    const dockActive = resolveDock(asStringArray(dockRaw), DEFAULT_DOCK);
    const density = asStringRecord(densityRaw)[auth.telegramUserId] ?? "normal";
    const voice =
      typeof voiceRaw === "string" && isBotVoice(voiceRaw)
        ? voiceRaw
        : DEFAULT_VOICE;

    return {
      dock: { available: [...DEFAULT_DOCK], active: [...dockActive] },
      moduleNames: moduleNameViews(asStringRecord(namesRaw)),
      density: { modes: [...DENSITY_MODES], current: density },
      voice: { options: [...BOT_VOICES], current: voice },
    };
  }

  @Put("groups/:gid/panel/dock")
  async setDock(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const parsed = dockSchema.safeParse(body);
    if (!parsed.success || !DEFAULT_DOCK.includes(parsed.data.id)) {
      throw new BadRequestException({ error: "invalid-dock-item" });
    }
    const auth = await this.authorize(req, gid);
    const { tenantId, chatId } = auth.chat;

    const current = resolveDock(
      asStringArray(await this.settings.getValue(tenantId, chatId, DOCK_KEY)),
      DEFAULT_DOCK,
    );
    const next = toggleFavorite(current, parsed.data.id, DEFAULT_DOCK.length);
    await this.settings.setValue(tenantId, chatId, DOCK_KEY, next);
    await this.audit(auth, gid, "miniapp.panel.dock", { dock: next });
    return { active: [...resolveDock(next, DEFAULT_DOCK)] };
  }

  @Put("groups/:gid/panel/module-name")
  async setModuleName(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const parsed = moduleNameSchema.safeParse(body);
    if (!parsed.success || !(parsed.data.key in DEFAULT_MODULE_NAMES)) {
      throw new BadRequestException({ error: "invalid-module" });
    }
    const auth = await this.authorize(req, gid);
    const { tenantId, chatId } = auth.chat;

    const overrides = asStringRecord(
      await this.settings.getValue(tenantId, chatId, MODULE_NAMES_KEY),
    );
    const desired = sanitizeModuleName(parsed.data.name ?? "");
    const next = { ...overrides };
    if (desired) {
      next[parsed.data.key] = desired;
    } else {
      delete next[parsed.data.key];
    }
    await this.settings.setValue(tenantId, chatId, MODULE_NAMES_KEY, next);
    await this.audit(auth, gid, "miniapp.panel.module-name", {
      key: parsed.data.key,
      name: desired || null,
    });
    return { moduleNames: moduleNameViews(next) };
  }

  @Put("groups/:gid/panel/density")
  async setDensity(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const parsed = densitySchema.safeParse(body);
    if (!parsed.success || !isDensityMode(parsed.data.mode)) {
      throw new BadRequestException({ error: "invalid-density" });
    }
    const auth = await this.authorize(req, gid);
    const { tenantId, chatId } = auth.chat;

    const byUser = asStringRecord(
      await this.settings.getValue(tenantId, chatId, DENSITY_KEY),
    );
    const next = { ...byUser, [auth.telegramUserId]: parsed.data.mode };
    await this.settings.setValue(tenantId, chatId, DENSITY_KEY, next);
    await this.audit(auth, gid, "miniapp.panel.density", {
      mode: parsed.data.mode,
    });
    return { current: parsed.data.mode };
  }

  @Put("groups/:gid/panel/voice")
  async setVoice(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const parsed = voiceSchema.safeParse(body);
    if (!parsed.success || !isBotVoice(parsed.data.voice)) {
      throw new BadRequestException({ error: "invalid-voice" });
    }
    const auth = await this.authorize(req, gid);
    const { tenantId, chatId } = auth.chat;

    await this.settings.setValue(
      tenantId,
      chatId,
      VOICE_KEY,
      parsed.data.voice,
    );
    await this.audit(auth, gid, "miniapp.panel.voice", {
      voice: parsed.data.voice,
    });
    return { current: parsed.data.voice };
  }

  private async audit(
    auth: AuthorizedPanel,
    gid: string,
    action: string,
    extra: Record<string, unknown>,
  ): Promise<void> {
    await this.foundation.recordAudit({
      tenantId: auth.chat.tenantId,
      actorType: "user",
      action,
      resourceType: "chat_setting",
      resourceId: gid,
      payload: {
        source: "miniapp",
        telegramUserId: auth.telegramUserId,
        ...extra,
      },
    });
  }

  private async authorize(
    req: MiniappRequest,
    gid: string,
  ): Promise<AuthorizedPanel> {
    const ctx = getMiniappContext(req);
    const bot = { username: ctx.botUsername, token: ctx.botToken };
    await this.admin.assertGroupAdmin(gid, ctx.userId, bot);
    const chat = await this.admin.resolveChat(gid, bot);
    return { chat, telegramUserId: ctx.userId };
  }
}

interface AuthorizedPanel {
  readonly chat: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly telegramChatId: string;
    readonly title?: string | undefined;
  };
  readonly telegramUserId: string;
}
