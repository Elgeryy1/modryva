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
  PrismaFoundationRepository,
  PrismaGuardianRepository,
} from "@superbot/data";
import { createStorageDriverFromEnv } from "@superbot/module-files";
import { validateGuardianSettings } from "@superbot/module-guardian";
import {
  type GuardianConfigInput,
  type GuardianDiagnosticsResult,
  type GuardianSessionSummary,
  getRuntimeEnv,
  guardianConfigSchema,
  resolveGestureVisionJudgeStatus,
  resolveGuardianMiniAppUrl,
} from "@superbot/shared";
import { HttpTelegramGateway } from "@superbot/telegram";
import { MiniappAdminService } from "./admin.service.js";
import {
  getMiniappContext,
  InitDataGuard,
  type MiniappRequest,
} from "./init-data.guard.js";

const DEFAULT_SETTINGS: GuardianSettingsState = {
  enabled: false,
  mode: "off",
  staffChatId: null,
  staffThreadId: null,
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
  locale: "es",
};

const toDto = (state: GuardianSettingsState): GuardianConfigInput => ({
  enabled: state.enabled,
  mode: state.mode,
  staffChatId: state.staffChatId?.toString() ?? null,
  staffThreadId: state.staffThreadId,
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
  locale: state.locale,
});

@Controller("v1/miniapp")
@UseGuards(InitDataGuard)
export class GuardianConfigController {
  private readonly guardian = new PrismaGuardianRepository();
  private readonly foundation = new PrismaFoundationRepository();
  private readonly gateway = new HttpTelegramGateway();

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
    const chat = await this.authorize(req, gid);
    const parsed = guardianConfigSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: "invalid-body" });
    }

    const issues = validateGuardianSettings({
      mode: parsed.data.mode,
      staffChatId: parsed.data.staffChatId
        ? BigInt(parsed.data.staffChatId)
        : null,
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

    const updated = await this.guardian.upsertSettings(
      chat.tenantId,
      chat.chatId,
      {
        enabled: parsed.data.enabled,
        mode: parsed.data.mode,
        staffChatId: parsed.data.staffChatId
          ? BigInt(parsed.data.staffChatId)
          : null,
        staffThreadId: parsed.data.staffThreadId,
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

    return { ...toDto(updated), warnings: issues };
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

    return {
      botIsAdmin,
      supportsJoinRequestQueries: me.supportsJoinRequestQueries ?? null,
      guardBotAssigned,
      staffChatConfigured: Boolean(settings?.staffChatId),
      staffChatReachable: settings?.staffChatId
        ? (
            await this.gateway.getChat({
              chatId: settings.staffChatId,
              token: ctx.botToken,
            })
          ).ok
        : null,
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

  private async authorize(req: MiniappRequest, gid: string) {
    const ctx = getMiniappContext(req);
    const bot = { username: ctx.botUsername, token: ctx.botToken };
    await this.admin.assertGroupAdmin(gid, ctx.userId, bot);
    return this.admin.resolveChat(gid, bot);
  }
}
