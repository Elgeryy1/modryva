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
  type GuardianSettingsState,
  PrismaBotGrantedAdminRepository,
  PrismaChatSettingRepository,
  PrismaFoundationRepository,
  PrismaGuardianRepository,
  PrismaMiniappVisitRepository,
} from "@superbot/data";
import {
  INTRODUCTION_SETTINGS_KEY,
  type IntroductionSettings,
  parseIntroductionSettings,
} from "@superbot/module-community";
import { createStorageDriverFromEnv } from "@superbot/module-files";
import {
  findIpMatches,
  validateGuardianSettings,
} from "@superbot/module-guardian";
import {
  APPOINTED_ADMIN_SETTINGS_KEY,
  type AppointedAdminSettings,
  parseAppointedAdminSettings,
} from "@superbot/module-security";
import {
  type AppointedAdminPanel,
  type GuardianConfigInput,
  type GuardianConfigIssue,
  type GuardianDiagnosticsResult,
  type GuardianRosterEntry,
  type GuardianRosterGroup,
  type GuardianRosterResult,
  type GuardianSessionSummary,
  getRuntimeEnv,
  guardianConfigSchema,
  resolveGestureVisionJudgeStatus,
  resolveGuardianMiniAppUrl,
} from "@superbot/shared";
import { HttpTelegramGateway } from "@superbot/telegram";
import {
  MiniappAdminService,
  type ResolvedMiniappChat,
} from "./admin.service.js";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "./init-data.guard.js";

/** Plain-Spanish name for each Mini App surface, for the roster's "last
 * action" column. Falls back to the raw surface for anything unmapped rather
 * than hiding it. */
/**
 * How many verification sessions the roster reads, newest first.
 *
 * Raised from the repository's old silent 500: at ~145 sessions today that was
 * months away, but growth crosses it without any signal. The screen now reports
 * when it is showing a partial view rather than implying it saw everything.
 */
const ROSTER_SESSION_LIMIT = 2000;

const SURFACE_LABEL: Record<string, string> = {
  games: "juegos",
  casino: "casino",
};

const DEFAULT_SETTINGS: GuardianSettingsState = {
  enabled: false,
  mode: "off",
  staffChatId: null,
  staffThreadId: null,
  extraStaffChats: [],
  captureMode: "video_with_fallback",
  challengeDifficulty: "normal",
  enabledChallenges: null,
  maxAttempts: 3,
  sessionTtlSeconds: 600,
  mediaRetentionHours: 72,
  autoApproveThreshold: 0.85,
  manualReviewThreshold: 0.55,
  livenessMinimum: 0.6,
  gestureMinimum: 0.6,
  replayRiskMaximum: 0.4,
  syntheticRiskMaximum: 0.4,
  requireSingleFace: true,
  estimateAge: false,
  minimumAge: null,
  maximumAge: null,
  requiredPhotos: 1,
  allowedCountries: [],
  allowAutomaticDecline: false,
  sendApprovedCasesToStaff: true,
  protectStaffContent: true,
  keepStaffPhotos: false,
  declineOnExpiry: false,
  locale: "es",
};

const toDto = (state: GuardianSettingsState): GuardianConfigInput => ({
  enabled: state.enabled,
  mode: state.mode,
  staffChatId: state.staffChatId?.toString() ?? null,
  staffThreadId: state.staffThreadId,
  extraStaffChats: [...state.extraStaffChats],
  captureMode: state.captureMode,
  challengeDifficulty: state.challengeDifficulty,
  maxAttempts: state.maxAttempts,
  sessionTtlSeconds: state.sessionTtlSeconds,
  mediaRetentionHours: state.mediaRetentionHours,
  autoApproveThreshold: state.autoApproveThreshold,
  manualReviewThreshold: state.manualReviewThreshold,
  livenessMinimum: state.livenessMinimum,
  gestureMinimum: state.gestureMinimum,
  replayRiskMaximum: state.replayRiskMaximum,
  syntheticRiskMaximum: state.syntheticRiskMaximum,
  requireSingleFace: state.requireSingleFace,
  estimateAge: state.estimateAge,
  minimumAge: state.minimumAge,
  maximumAge: state.maximumAge,
  requiredPhotos: state.requiredPhotos === 2 ? 2 : 1,
  allowedCountries: [...state.allowedCountries],
  allowAutomaticDecline: state.allowAutomaticDecline,
  sendApprovedCasesToStaff: true,
  protectStaffContent: state.protectStaffContent,
  keepStaffPhotos: state.keepStaffPhotos,
  declineOnExpiry: state.declineOnExpiry,
  locale: state.locale,
});

@Controller("v1/miniapp")
@UseGuards(InitDataGuard)
export class GuardianConfigController {
  private readonly guardian = new PrismaGuardianRepository();
  private readonly foundation = new PrismaFoundationRepository();
  private readonly visits = new PrismaMiniappVisitRepository();
  private readonly gateway = new HttpTelegramGateway();
  private readonly appointed = new PrismaBotGrantedAdminRepository();
  private readonly settings = new PrismaChatSettingRepository();

  // Explicit @Inject: tsx/esbuild does not emit decorator metadata.
  constructor(
    @Inject(MiniappAdminService) private readonly admin: MiniappAdminService,
  ) {}

  @Get("groups/:gid/guardian")
  async getSettings(@Req() req: MiniappRequest, @Param("gid") gid: string) {
    const chat = await this.authorize(req, gid);
    const state = await this.guardian.getSettings(chat.tenantId, chat.chatId);
    return state ? toDto(state) : toDto(DEFAULT_SETTINGS);
  }

  @Put("groups/:gid/guardian")
  async updateSettings(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ) {
    const ctx = getMiniappContext(req);
    const chat = await this.authorizeChange(req, gid);
    const parsed = guardianConfigSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: "invalid-body" });
    }

    const staffChatId = parsed.data.staffChatId
      ? BigInt(parsed.data.staffChatId)
      : null;
    const issues = validateGuardianSettings({
      mode: parsed.data.mode,
      staffChatId,
      maxAttempts: parsed.data.maxAttempts,
      sessionTtlSeconds: parsed.data.sessionTtlSeconds,
      mediaRetentionHours: parsed.data.mediaRetentionHours,
      autoApproveThreshold: parsed.data.autoApproveThreshold,
      manualReviewThreshold: parsed.data.manualReviewThreshold,
      livenessMinimum: parsed.data.livenessMinimum,
      gestureMinimum: parsed.data.gestureMinimum,
      replayRiskMaximum: parsed.data.replayRiskMaximum,
      syntheticRiskMaximum: parsed.data.syntheticRiskMaximum,
      estimateAge: parsed.data.estimateAge,
      minimumAge: parsed.data.minimumAge,
      maximumAge: parsed.data.maximumAge,
      sendApprovedCasesToStaff: parsed.data.sendApprovedCasesToStaff,
    });
    const blocking = issues.filter((i) => i.severity === "error");
    if (blocking.length > 0) {
      throw new BadRequestException({ error: "invalid-settings", issues });
    }

    // El fallo que el validador no puede ver: un id que el bot no puede usar.
    // Solo Telegram sabe si ese chat existe y si el bot esta dentro, asi que
    // esto avisa y NO bloquea — si Telegram falla, guardar los ajustes tiene
    // que seguir siendo posible. Sin el aviso, el unico sintoma de un id mal
    // puesto es que los expedientes no aparecen en ningun sitio, y eso se
    // descubre cuando ya hay alguien esperando en la puerta.
    const avisos: GuardianConfigIssue[] = [...issues];
    if (
      staffChatId !== null &&
      !(await this.alcanzaChat(staffChatId, ctx.botToken))
    ) {
      avisos.push({
        field: "staffChatId",
        code: "unreachable",
        message:
          "El bot no puede escribir en ese chat STAFF: Telegram responde que no existe o que el bot no está dentro. Comprueba el ID —los supergrupos empiezan por -100, y un grupo que se convierte en supergrupo cambia de ID— y que el bot esté dentro. Hasta entonces los expedientes no le llegarán a nadie.",
        severity: "warning",
      });
    }

    const updated = await this.guardian.upsertSettings(
      chat.tenantId,
      chat.chatId,
      {
        enabled: parsed.data.enabled,
        mode: parsed.data.mode,
        staffChatId,
        staffThreadId: parsed.data.staffThreadId,
        extraStaffChats: parsed.data.extraStaffChats,
        captureMode: parsed.data.captureMode,
        challengeDifficulty: parsed.data.challengeDifficulty,
        maxAttempts: parsed.data.maxAttempts,
        sessionTtlSeconds: parsed.data.sessionTtlSeconds,
        mediaRetentionHours: parsed.data.mediaRetentionHours,
        autoApproveThreshold: parsed.data.autoApproveThreshold,
        manualReviewThreshold: parsed.data.manualReviewThreshold,
        livenessMinimum: parsed.data.livenessMinimum,
        gestureMinimum: parsed.data.gestureMinimum,
        replayRiskMaximum: parsed.data.replayRiskMaximum,
        syntheticRiskMaximum: parsed.data.syntheticRiskMaximum,
        requireSingleFace: parsed.data.requireSingleFace,
        estimateAge: parsed.data.estimateAge,
        minimumAge: parsed.data.minimumAge,
        maximumAge: parsed.data.maximumAge,
        requiredPhotos: parsed.data.requiredPhotos,
        allowedCountries: parsed.data.allowedCountries,
        allowAutomaticDecline: parsed.data.allowAutomaticDecline,
        sendApprovedCasesToStaff: true,
        protectStaffContent: parsed.data.protectStaffContent,
        keepStaffPhotos: parsed.data.keepStaffPhotos,
        declineOnExpiry: parsed.data.declineOnExpiry,
        locale: parsed.data.locale,
      },
    );

    await this.foundation.recordAudit({
      tenantId: chat.tenantId,
      actorType: "user",
      action: "miniapp.guardian.configured",
      resourceType: "guardian_settings",
      resourceId: gid,
      payload: {
        mode: updated.mode,
        enabled: updated.enabled,
        telegramUserId: ctx.userId,
        issues: issues.length > 0 ? issues : undefined,
      },
    });

    return { ...toDto(updated), warnings: avisos };
  }

  @Get("groups/:gid/guardian/diagnostics")
  async diagnostics(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
  ): Promise<GuardianDiagnosticsResult> {
    const chat = await this.authorize(req, gid);
    const ctx = getMiniappContext(req);
    const settings = await this.guardian.getSettings(
      chat.tenantId,
      chat.chatId,
    );
    const env = getRuntimeEnv();

    const me = await this.gateway.getMe({ token: ctx.botToken });

    let botIsAdmin = false;
    if (me.botUserId !== undefined) {
      const membership = await this.gateway.getChatMember({
        chatId: BigInt(chat.telegramChatId),
        userId: me.botUserId,
        token: ctx.botToken,
      });
      botIsAdmin =
        membership.status === "administrator" ||
        membership.status === "creator";
    }

    let guardBotAssigned: boolean | null = null;
    try {
      const chatInfo = await this.gateway.getChat({
        chatId: BigInt(chat.telegramChatId),
        token: ctx.botToken,
      });
      guardBotAssigned = chatInfo.chat?.guardBot ?? null;
    } catch {
      guardBotAssigned = null;
    }

    let storageReachable = true;
    try {
      const driver = createStorageDriverFromEnv(env);
      await driver.exists("diagnostics-probe");
    } catch {
      storageReachable = false;
    }

    const gestureVisionJudge = resolveGestureVisionJudgeStatus(env);
    const visualAnalyzerConfigured = Boolean(env.AI_SERVICE_URL);
    let visualAnalyzerReachable: boolean | null = null;
    if (env.AI_SERVICE_URL) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const response = await fetch(`${env.AI_SERVICE_URL}/healthz`, {
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout));
        visualAnalyzerReachable = response.ok;
      } catch {
        visualAnalyzerReachable = false;
      }
    }

    const staffChatReachable = settings?.staffChatId
      ? await this.alcanzaChat(settings.staffChatId, ctx.botToken)
      : null;

    return {
      botIsAdmin,
      supportsJoinRequestQueries: me.supportsJoinRequestQueries ?? null,
      guardBotAssigned,
      staffChatConfigured: Boolean(settings?.staffChatId),
      staffChatReachable,
      storageReachable,
      miniAppUrlConfigured: Boolean(resolveGuardianMiniAppUrl(env)),
      sessionSecretConfigured: Boolean(env.GUARDIAN_SESSION_SECRET),
      gestureVisionJudgeFlagEnabled: gestureVisionJudge.flagEnabled,
      gestureVisionJudgeKeysConfigured: gestureVisionJudge.keysConfigured,
      gestureVisionJudgeConfigured: gestureVisionJudge.configured,
      visualAnalyzerConfigured,
      visualAnalyzerReachable,
    };
  }

  /**
   * The appointed-admin panel: who the bot can revoke, who it cannot, and the
   * guard's thresholds. Same admin gate as everything else here — handing out
   * or taking away moderation powers is itself a moderation power.
   */
  @Get("groups/:gid/appointed-admins")
  async appointedAdmins(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
  ): Promise<AppointedAdminPanel> {
    const chat = await this.authorize(req, gid);
    const ctx = getMiniappContext(req);
    const rows = await this.appointed.list(chat.tenantId, chat.chatId);
    const settings = parseAppointedAdminSettings(
      await this.settings
        .getValue(chat.tenantId, chat.chatId, APPOINTED_ADMIN_SETTINGS_KEY)
        .catch(() => undefined),
    );

    // The live Telegram list is what actually holds power; ours is only what we
    // can take back. Surfacing the gap is the point — an admin promoted by hand
    // is permanently beyond the guard, and hiding that would be a false
    // promise of protection.
    const live = await this.gateway
      .getChatAdministrators({
        chatId: BigInt(chat.telegramChatId),
        token: ctx.botToken,
      })
      .catch(() => ({ ok: false, admins: [] as never[] }));
    const ours = new Set(
      rows
        .filter((row) => row.status === "active")
        .map((row) => row.telegramUserId.toString()),
    );
    // The owner can be demoted by nobody, and the serving bot is not a threat
    // to itself. Counting either would make a healthy group read as exposed.
    const botId = ctx.botToken?.split(":")[0];
    const beyondReach = (live.admins ?? [])
      .filter(
        (admin) =>
          !admin.isOwner &&
          admin.userId.toString() !== botId &&
          !ours.has(admin.userId.toString()),
      )
      .map((admin) => ({
        telegramUserId: admin.userId.toString(),
        username: admin.username ?? null,
        displayName: admin.firstName ?? null,
      }));

    return {
      settings,
      // Telegram could not be reached, so "nobody is beyond reach" would be a
      // guess. The UI says so rather than showing a reassuring empty list.
      liveListAvailable: live.ok === true,
      appointed: rows.map((row) => ({
        telegramUserId: row.telegramUserId.toString(),
        username: row.username,
        displayName: row.displayName,
        customTitle: row.customTitle,
        grantedByTelegramId: row.grantedByTelegramId.toString(),
        grantedAt: row.grantedAt.toISOString(),
        status: row.status,
        revokedAt: row.revokedAt?.toISOString() ?? null,
        revokedReason: row.revokedReason,
        adoptedExisting: row.adoptedExisting,
      })),
      beyondReach,
    };
  }

  /** The mandatory-introduction gate. Lives beside the appointed-admin settings
   * because both are per-chat objects in the shared chat_settings store. */
  @Get("groups/:gid/introduction")
  async introductionSettings(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
  ): Promise<{ settings: IntroductionSettings }> {
    const chat = await this.authorize(req, gid);
    return {
      settings: parseIntroductionSettings(
        await this.settings
          .getValue(chat.tenantId, chat.chatId, INTRODUCTION_SETTINGS_KEY)
          .catch(() => undefined),
      ),
    };
  }

  @Put("groups/:gid/introduction")
  async updateIntroduction(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ): Promise<{ settings: IntroductionSettings }> {
    const ctx = getMiniappContext(req);
    const chat = await this.authorizeChange(req, gid);
    // Permissive parse by design: anything malformed falls back to a default
    // rather than being stored, because this setting REMOVES PEOPLE and a
    // garbled body must never be what starts doing that.
    const settings = parseIntroductionSettings(body);
    await this.settings.setValue(
      chat.tenantId,
      chat.chatId,
      INTRODUCTION_SETTINGS_KEY,
      settings,
    );
    await this.foundation.recordAudit({
      tenantId: chat.tenantId,
      actorType: "user",
      action: "miniapp.introduction.configured",
      resourceType: "chat_setting",
      resourceId: gid,
      payload: {
        enabled: settings.enabled,
        deadlineHours: settings.deadlineHours,
        telegramUserId: ctx.userId,
      },
    });
    return { settings };
  }

  @Put("groups/:gid/appointed-admins/settings")
  async updateAppointedAdmins(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
    @Body() body: unknown,
  ): Promise<{ settings: AppointedAdminSettings }> {
    const ctx = getMiniappContext(req);
    // The escalation this rule exists for: without it, an appointed admin could
    // open this very screen and disable the guard that watches them.
    const chat = await this.authorizeChange(req, gid);
    // parse* is permissive by design (see its doc): anything malformed falls
    // back to a default rather than being stored as-is, so a bad PUT can never
    // leave the guard enforcing on garbage thresholds.
    const settings = parseAppointedAdminSettings(body);
    await this.settings.setValue(
      chat.tenantId,
      chat.chatId,
      APPOINTED_ADMIN_SETTINGS_KEY,
      settings,
    );
    await this.foundation.recordAudit({
      tenantId: chat.tenantId,
      actorType: "user",
      action: "miniapp.appointed_admins.configured",
      resourceType: "chat_setting",
      resourceId: gid,
      payload: {
        enabled: settings.enabled,
        mode: settings.mode,
        telegramUserId: ctx.userId,
      },
    });
    return { settings };
  }

  @Get("groups/:gid/guardian/sessions")
  async recentSessions(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
  ): Promise<{ sessions: GuardianSessionSummary[] }> {
    const chat = await this.authorize(req, gid);
    const rows = await this.guardian.listSessionsByChat(chat.chatId, 20);
    return {
      sessions: rows.map((row) => ({
        id: row.id,
        shortId: `VER-${row.id.slice(-8).toUpperCase()}`,
        telegramUserId: row.telegramUserId.toString(),
        displayName:
          [row.firstName, row.lastName].filter(Boolean).join(" ") ||
          row.username ||
          row.telegramUserId.toString(),
        status: row.status,
        decision: row.decision,
        createdAt: row.createdAt.toISOString(),
        resolvedAt: row.resolvedAt?.toISOString() ?? null,
      })),
    };
  }

  /**
   * The verification roster: every person who has verified in this group, with
   * the connection they came from and who else shares it. Admin-gated by the
   * same assertGroupAdmin as every other endpoint here, and scoped to the one
   * group — this is personal data (IPs tied to accounts), so it must never be
   * reachable by a non-admin or leak across groups.
   *
   * One row per PERSON, not per session: repeat verifications collapse into a
   * count so the screen reads as a member list rather than a log.
   */
  @Get("groups/:gid/guardian/roster")
  async roster(
    @Req() req: MiniappRequest,
    @Param("gid") gid: string,
  ): Promise<GuardianRosterResult> {
    // Telegram caches Mini App bundles hard, so a client running yesterday's
    // JavaScript decodes the `bd_all` deep link with yesterday's rules and
    // routes it here as the literal "all". Serve the cross-group view instead
    // of rejecting it: "all" is not a chat id and never can be (they are
    // numeric), and the authorization is identical either way — it comes from
    // listAdminChats, not from this string.
    if (gid === "all") {
      return this.rosterAcrossGroups(req);
    }
    const chat = await this.authorize(req, gid);
    return this.buildRoster([chat], getMiniappContext(req).botUsername, false);
  }

  /**
   * The same roster folded across EVERY group the caller administers, so an
   * owner can see one person's whole footprint instead of opening a screen per
   * community — and so a shared connection spanning two of their groups is
   * visible at all, which the per-group view structurally cannot show.
   *
   * Deliberately has no `:gid` and takes no group list from the client: the set
   * of groups comes from listAdminChats, which re-derives admin rights from
   * Telegram. An admin of one group calling this gets exactly their one group,
   * so the endpoint widens what an OWNER sees without widening anyone else's.
   */
  @Get("guardian/roster")
  async rosterAcrossGroups(
    @Req() req: MiniappRequest,
  ): Promise<GuardianRosterResult> {
    const ctx = getMiniappContext(req);
    const chats = await this.admin.listAdminChats(ctx.userId, {
      username: ctx.botUsername,
      token: ctx.botToken,
    });
    // The owner also gets opens that belong to NO group — someone who only ever
    // launched the games app from a private chat. Nobody else can: a group-less
    // visit names no community, so no group-admin claim reaches it.
    return this.buildRoster(
      chats,
      ctx.botUsername,
      this.admin.isPlatformOwner(ctx.userId),
    );
  }

  private async buildRoster(
    chats: readonly ResolvedMiniappChat[],
    botUsername: string,
    includeGrouplessVisits: boolean,
  ): Promise<GuardianRosterResult> {
    const groups: GuardianRosterGroup[] = chats.map((chat) => ({
      telegramChatId: chat.telegramChatId,
      title: chat.title ?? chat.telegramChatId,
    }));
    // An owner with no groups at all still has private-chat opens to show.
    if (chats.length === 0 && !includeGrouplessVisits) {
      return { entries: [], groups };
    }
    // Internal chat id -> group, for verification rows; Telegram id -> group,
    // for Mini App visits. The two sources key on different ids.
    const groupByChatId = new Map(
      chats.map((chat, index) => [
        chat.chatId,
        groups[index] as GuardianRosterGroup,
      ]),
    );
    const groupByTelegramId = new Map(
      chats.map((chat, index) => [
        chat.telegramChatId,
        groups[index] as GuardianRosterGroup,
      ]),
    );

    // Ask for ONE more than we intend to show, purely to find out whether more
    // exist. The old call took the default 500 and said nothing when it hit it,
    // so past that point the roster quietly became a partial view that still
    // read as complete — the worst way for a screen about fraud signals to
    // fail, because a missing shared connection looks identical to none.
    const fetched = await this.guardian.listIpNeighboursForChats(
      chats.map((chat) => chat.chatId),
      ROSTER_SESSION_LIMIT + 1,
    );
    const truncated = fetched.length > ROSTER_SESSION_LIMIT;
    const rows = truncated ? fetched.slice(0, ROSTER_SESSION_LIMIT) : fetched;
    // Members who opened a Mini App without ever verifying — most of them.
    // Scoped to THESE groups, plus group-less opens by people already known in
    // one of them from a verification: one bot serves many groups, and an
    // unrelated community's IPs must never appear in front of these admins.
    // Best-effort: the roster still works without it.
    const knownUserIds = [...new Set(rows.map((row) => row.telegramUserId))];
    const appVisits = await (includeGrouplessVisits
      ? this.visits.listForBot(botUsername)
      : this.visits.listForGroups(
          botUsername,
          chats.map((chat) => BigInt(chat.telegramChatId)),
          knownUserIds,
        )
    ).catch(() => []);

    // Where each person has been seen, deduped by Telegram chat id.
    const groupsByUser = new Map<string, Map<string, GuardianRosterGroup>>();
    const noteGroup = (
      telegramUserId: string,
      group: GuardianRosterGroup | undefined,
    ): void => {
      if (!group) {
        return;
      }
      let seen = groupsByUser.get(telegramUserId);
      if (!seen) {
        seen = new Map();
        groupsByUser.set(telegramUserId, seen);
      }
      seen.set(group.telegramChatId, group);
    };
    for (const row of rows) {
      noteGroup(row.telegramUserId.toString(), groupByChatId.get(row.chatId));
    }
    for (const visit of appVisits) {
      // A group-less visit (the portable hub) names no community, so it adds
      // nothing here — the person's groups come from where they were actually
      // seen, never from a visit that could have happened anywhere.
      if (visit.groupTelegramId !== null) {
        noteGroup(
          visit.telegramUserId.toString(),
          groupByTelegramId.get(visit.groupTelegramId.toString()),
        );
      }
    }
    const groupsOf = (id: string): GuardianRosterGroup[] => [
      ...(groupsByUser.get(id)?.values() ?? []),
    ];

    const nameOf = (row: (typeof rows)[number]): string =>
      (row.username ? `@${row.username}` : "") ||
      [row.firstName, row.lastName].filter(Boolean).join(" ") ||
      row.telegramUserId.toString();

    // rows arrive newest-first, so the FIRST row seen for a person is their
    // latest — later rows only extend the count and push firstSeen back.
    const visitOnly = new Map<string, (typeof appVisits)[number]>();
    const byUser = new Map<
      string,
      {
        row: (typeof rows)[number];
        verifications: number;
        firstSeen: Date;
      }
    >();
    for (const row of rows) {
      const id = row.telegramUserId.toString();
      const existing = byUser.get(id);
      if (existing) {
        existing.verifications += 1;
        if (row.createdAt < existing.firstSeen) {
          existing.firstSeen = row.createdAt;
        }
      } else {
        byUser.set(id, {
          row,
          verifications: 1,
          firstSeen: row.createdAt,
        });
      }
    }

    const visitName = (visit: (typeof appVisits)[number]): string =>
      (visit.username ? `@${visit.username}` : "") ||
      [visit.firstName, visit.lastName].filter(Boolean).join(" ") ||
      visit.telegramUserId.toString();

    // Both sources feed the same connection pool, so a verified person and a
    // games-only account sharing an address surface each other.
    const neighbours = [
      ...rows.map((row) => ({
        telegramUserId: row.telegramUserId.toString(),
        displayName: nameOf(row),
        ip: row.verifierIp,
        lastSeen: row.createdAt,
      })),
      ...appVisits.map((visit) => ({
        telegramUserId: visit.telegramUserId.toString(),
        displayName: visitName(visit),
        ip: visit.ip,
        lastSeen: visit.lastSeenAt,
      })),
    ];

    // A person who only ever opened a Mini App still belongs in the roster —
    // they are exactly who the check was blind to before. Verified people keep
    // their richer row; these only fill the gaps.
    //
    // Verified people ALSO get their latest app visit tracked here, because a
    // row that stops at "verified on Tuesday" is misleading once that same
    // person has been playing every day since — and their current connection,
    // which is what the multi-account check cares about, is the newer one.
    const latestVisit = new Map<string, (typeof appVisits)[number]>();
    for (const visit of appVisits) {
      const id = visit.telegramUserId.toString();
      const seen = latestVisit.get(id);
      if (!seen || visit.lastSeenAt > seen.lastSeenAt) {
        latestVisit.set(id, visit);
      }
      if (!byUser.has(id)) {
        visitOnly.set(id, visit);
      }
    }

    const entries: GuardianRosterEntry[] = [...byUser.entries()].map(
      ([id, entry]) => {
        const visit = latestVisit.get(id);
        // Whichever happened later is what "last seen" and the current
        // connection should reflect.
        const playedLast =
          visit !== undefined && visit.lastSeenAt > entry.row.createdAt;
        const ip = playedLast && visit ? visit.ip : entry.row.verifierIp;
        return {
          telegramUserId: id,
          displayName: nameOf(entry.row),
          username: entry.row.username,
          ip,
          countryCode:
            (playedLast && visit ? visit.countryCode : null) ??
            entry.row.countryCode,
          firstSeen: entry.firstSeen.toISOString(),
          lastSeen: (playedLast && visit
            ? visit.lastSeenAt
            : entry.row.createdAt
          ).toISOString(),
          lastActivity:
            playedLast && visit
              ? (SURFACE_LABEL[visit.surface] ?? visit.surface)
              : "verificación",
          verifications: entry.verifications,
          lastStatus: entry.row.status,
          lastDecision: entry.row.decision,
          // Opened the Mini App, submitted nothing, timed out. The decision
          // engine still stamps manual_review on those, so read the attempt
          // count rather than the decision to tell them apart.
          abandoned:
            entry.row.attemptCount === 0 && entry.row.status === "expired",
          sharesConnectionWith: findIpMatches(ip, id, neighbours).map(
            (match) => ({
              telegramUserId: match.telegramUserId,
              displayName: match.displayName,
              strength: match.strength,
            }),
          ),
          groups: groupsOf(id),
        };
      },
    );

    for (const [id, visit] of visitOnly.entries()) {
      entries.push({
        telegramUserId: id,
        displayName: visitName(visit),
        username: visit.username,
        ip: visit.ip,
        countryCode: visit.countryCode,
        firstSeen: visit.firstSeenAt.toISOString(),
        lastSeen: visit.lastSeenAt.toISOString(),
        lastActivity: SURFACE_LABEL[visit.surface] ?? visit.surface,
        // Never verified — the count refers to verifications, not app opens.
        verifications: 0,
        lastStatus: visit.surface,
        lastDecision: null,
        abandoned: false,
        sharesConnectionWith: findIpMatches(visit.ip, id, neighbours).map(
          (match) => ({
            telegramUserId: match.telegramUserId,
            displayName: match.displayName,
            strength: match.strength,
          }),
        ),
        groups: groupsOf(id),
      });
    }

    // Anyone sharing a connection floats to the top — that is the whole reason
    // this screen exists; the rest is chronological.
    entries.sort((a, b) => {
      const shared =
        (b.sharesConnectionWith.length > 0 ? 1 : 0) -
        (a.sharesConnectionWith.length > 0 ? 1 : 0);
      return shared !== 0 ? shared : b.lastSeen.localeCompare(a.lastSeen);
    });

    return { entries, groups, truncated };
  }

  /**
   * Si el bot puede hablar con ese chat.
   *
   * `getChat` LANZA ante cualquier respuesta que no sea 2xx, y "chat not found"
   * es un 400: llega como excepcion, no como `ok: false`. Ese es justo el caso
   * normal de un chat STAFF mal puesto —el id en positivo, sin el `-100`, o un
   * grupo que se convirtio en supergrupo y cambio de id—, asi que dejar subir
   * la excepcion tumbaba el diagnostico entero con un 500 y la pantalla solo
   * sabia decir "http-500". La comprobacion que tenia la respuesta era la que
   * reventaba.
   */
  private async alcanzaChat(chatId: bigint, token: string): Promise<boolean> {
    try {
      return (await this.gateway.getChat({ chatId, token })).ok;
    } catch {
      return false;
    }
  }

  private async authorize(req: MiniappRequest, gid: string) {
    const ctx = getMiniappContext(req);
    const bot = { username: ctx.botUsername, token: ctx.botToken };
    await this.admin.assertGroupAdmin(gid, ctx.userId, bot);
    return this.admin.resolveChat(gid, bot);
  }

  /**
   * For anything that CHANGES settings. Admins the bot appointed can read this
   * screen but not rewrite it — otherwise the guard watching them would be one
   * toggle away from being switched off by them.
   */
  private async authorizeChange(req: MiniappRequest, gid: string) {
    const ctx = getMiniappContext(req);
    const bot = { username: ctx.botUsername, token: ctx.botToken };
    await this.admin.assertCanChangeSettings(gid, ctx.userId, bot);
    return this.admin.resolveChat(gid, bot);
  }
}
