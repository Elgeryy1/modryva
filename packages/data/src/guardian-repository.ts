import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";
import { decryptManagedBotToken } from "./platform-repository.js";

export type GuardianModeValue =
  | "off"
  | "manual"
  | "assisted"
  | "auto"
  | "strict";
export type GuardianCaptureModeValue =
  | "photo"
  | "video"
  | "video_with_fallback";
export type GuardianChallengeDifficultyValue = "basic" | "normal" | "strict";
export type GuardianSessionStatusValue =
  | "pending"
  | "miniapp_opened"
  | "capturing"
  | "analyzing"
  | "awaiting_retry"
  | "resolved"
  | "expired"
  | "cancelled";
export type GuardianDecisionValue =
  | "auto_approve"
  | "manual_review"
  | "retry"
  | "auto_decline"
  | "technical_failure";
export type GuardianProviderStatusValue =
  | "success"
  | "uncertain"
  | "unavailable"
  | "failed"
  | "not_evaluated";
export type GuardianProvenanceStatusValue =
  | "c2pa_valid_ai_declared"
  | "c2pa_valid_other"
  | "c2pa_invalid"
  | "c2pa_not_found"
  | "c2pa_unavailable";
export type GuardianStaffActionValue =
  | "approve"
  | "decline"
  | "retry"
  | "delete_media"
  | "mark_false_positive"
  | "expel";

// --- Settings ---

export interface GuardianSettingsState {
  readonly enabled: boolean;
  readonly mode: GuardianModeValue;
  readonly staffChatId: bigint | null;
  readonly staffThreadId: number | null;
  readonly captureMode: GuardianCaptureModeValue;
  readonly challengeDifficulty: GuardianChallengeDifficultyValue;
  readonly enabledChallenges: readonly string[] | null;
  readonly maxAttempts: number;
  readonly sessionTtlSeconds: number;
  readonly mediaRetentionHours: number;
  readonly autoApproveThreshold: number;
  readonly manualReviewThreshold: number;
  readonly livenessMinimum: number;
  readonly gestureMinimum: number;
  readonly replayRiskMaximum: number;
  readonly syntheticRiskMaximum: number;
  readonly requireSingleFace: boolean;
  readonly estimateAge: boolean;
  readonly minimumAge: number | null;
  readonly maximumAge: number | null;
  /** 1 (default) or 2. When 2, the Mini App captures a second photo with a
   * different gesture and the AI must confirm it's the same person. */
  readonly requiredPhotos: number;
  /** ISO 3166-1 alpha-2 codes. Empty = no restriction — see
   * decision-engine.ts's countryCode gate. */
  readonly allowedCountries: readonly string[];
  readonly allowAutomaticDecline: boolean;
  readonly sendApprovedCasesToStaff: boolean;
  readonly protectStaffContent: boolean;
  readonly locale: string;
}

export type GuardianSettingsUpdate = Partial<GuardianSettingsState>;

// --- Sessions ---

export interface CreateVerificationSessionInput {
  readonly tenantId: string;
  readonly chatId: string;
  readonly telegramChatId: bigint;
  readonly telegramUserId: bigint;
  readonly userChatId?: bigint;
  readonly joinRequestQueryIdEncrypted?: string;
  readonly username?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly languageCode?: string;
  readonly inviteLinkName?: string;
  readonly mode: GuardianModeValue;
  readonly challengeDefinition: Record<string, unknown>;
  readonly challengeNonce: string;
  readonly sessionTokenHash: string;
  readonly expiresAt: Date;
  readonly idempotencyKey: string;
}

export interface VerificationSessionRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly chatId: string;
  readonly telegramChatId: bigint;
  readonly telegramUserId: bigint;
  readonly userChatId: bigint | null;
  readonly joinRequestQueryIdEncrypted: string | null;
  readonly username: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly inviteLinkName: string | null;
  /** ISO 3166-1 alpha-2, resolved from the person's IP on the Mini App's
   * first request and pinned — see decision-engine.ts's countryCode gate. */
  readonly countryCode: string | null;
  readonly status: GuardianSessionStatusValue;
  readonly decision: GuardianDecisionValue | null;
  readonly decisionReason: string | null;
  readonly decisionPayload: unknown;
  readonly mode: GuardianModeValue;
  readonly challengeDefinition: unknown;
  readonly challengeNonce: string;
  readonly sessionTokenHash: string;
  readonly expiresAt: Date;
  readonly attemptCount: number;
  readonly createdAt: Date;
  readonly completedAt: Date | null;
  readonly resolvedAt: Date | null;
  readonly staffChatId: bigint | null;
  readonly staffMessageId: number | null;
  readonly staffReportMessageId: number | null;
  /** When the STAFF report message becomes eligible for retention deletion.
   * Stamped at send time so the cleanup job is driven by the session itself,
   * independent of the media table's mutable delete cursor. */
  readonly staffReportDeleteAfter: Date | null;
  readonly version: number;
  readonly idempotencyKey: string | null;
}

export interface ResolveSessionInput {
  readonly status: GuardianSessionStatusValue;
  readonly decision?: GuardianDecisionValue;
  readonly decisionReason?: string;
  readonly decisionPayload?: Record<string, unknown>;
  readonly resolvedAt?: Date;
  readonly completedAt?: Date;
  readonly clearIdempotencyKey?: boolean;
  readonly clearQueryId?: boolean;
  readonly staffChatId?: bigint;
  readonly staffMessageId?: number;
  readonly staffReportMessageId?: number;
  readonly staffReportDeleteAfter?: Date;
  /** Set when STAFF requests a retry: rotates the session to a fresh
   * resumable token/TTL so a new Mini App link can be issued to the user
   * (the original token is never persisted in plaintext, so it can't be
   * resent as-is). */
  readonly sessionTokenHash?: string;
  readonly expiresAt?: Date;
}

// --- Attempts / Media / Analysis / Staff decisions ---

export interface CreateAttemptInput {
  readonly sessionId: string;
  readonly attemptNumber: number;
  readonly captureType: string;
}

export interface VerificationAttemptRecord {
  readonly id: string;
  readonly sessionId: string;
  readonly attemptNumber: number;
  readonly captureType: string;
  readonly startedAt: Date | null;
  readonly finishedAt: Date | null;
  readonly clientEvidence: unknown;
  readonly analysisStatus: GuardianProviderStatusValue;
  readonly failureReason: string | null;
}

export interface CreateMediaInput {
  readonly sessionId: string;
  readonly attemptId?: string;
  readonly objectStorageKey: string;
  readonly thumbnailStorageKey?: string;
  readonly mimeDetected?: string;
  readonly mimeDeclared?: string;
  readonly sizeBytes?: number;
  readonly width?: number;
  readonly height?: number;
  readonly durationMs?: number;
  readonly fps?: number;
  readonly codec?: string;
  readonly sha256: string;
  readonly perceptualHash?: string;
  readonly deleteAfter: Date;
}

export interface VerificationMediaRecord {
  readonly id: string;
  readonly sessionId: string;
  readonly attemptId: string | null;
  readonly objectStorageKey: string;
  readonly thumbnailStorageKey: string | null;
  readonly mimeDetected: string | null;
  readonly sha256: string;
  readonly perceptualHash: string | null;
  readonly deleteAfter: Date;
  readonly deletedAt: Date | null;
}

export interface UpsertAnalysisInput {
  readonly attemptId: string;
  readonly faceCount?: number;
  readonly faceConfidence?: number;
  readonly gestureRequested?: string;
  readonly gestureDetected?: string;
  readonly gestureScore?: number;
  readonly headMovementRequested?: string;
  readonly headMovementDetected?: string;
  readonly headMovementScore?: number;
  readonly blinkRequested?: boolean;
  readonly blinkDetected?: boolean;
  readonly livenessScore?: number;
  readonly livenessStatus?: GuardianProviderStatusValue;
  readonly replayRisk?: number;
  readonly screenReplayRisk?: number;
  readonly syntheticMediaRisk?: number;
  readonly syntheticStatus?: GuardianProviderStatusValue;
  readonly provenanceStatus?: GuardianProvenanceStatusValue;
  readonly estimatedAgeMin?: number;
  readonly estimatedAgeMax?: number;
  readonly ageConfidence?: number;
  readonly ageStatus?: GuardianProviderStatusValue;
  readonly qualityScore?: number;
  readonly lightingScore?: number;
  readonly hardFailures?: readonly string[];
  readonly warnings?: readonly string[];
  readonly modelVersions?: Record<string, string>;
  readonly analysisDurationMs?: number;
  readonly rawTechnicalReport?: Record<string, unknown>;
}

export interface CreateStaffDecisionInput {
  readonly sessionId: string;
  readonly moderatorTelegramId: bigint;
  readonly action: GuardianStaffActionValue;
  readonly reason?: string;
}

export interface StaffDecisionRecord {
  readonly id: string;
  readonly sessionId: string;
  readonly moderatorTelegramId: bigint;
  readonly action: GuardianStaffActionValue;
  readonly reason: string | null;
  readonly createdAt: Date;
}

export interface GuardianRepository {
  getSettings(
    tenantId: string,
    chatId: string,
  ): Promise<GuardianSettingsState | null>;
  upsertSettings(
    tenantId: string,
    chatId: string,
    update: GuardianSettingsUpdate,
  ): Promise<GuardianSettingsState>;

  createSession(
    input: CreateVerificationSessionInput,
  ): Promise<VerificationSessionRecord | null>;
  findSessionByTokenHash(
    sessionTokenHash: string,
  ): Promise<VerificationSessionRecord | null>;
  findActiveSession(
    chatId: string,
    telegramUserId: bigint,
  ): Promise<VerificationSessionRecord | null>;
  findSessionById(id: string): Promise<VerificationSessionRecord | null>;
  /** Pins the country resolved from the person's IP on the FIRST request that
   * carries one — a no-op once countryCode is already set, so a later
   * request (e.g. after enabling a VPN mid-flow) can never overwrite the
   * earliest, most-trustworthy reading. */
  setSessionCountryIfUnset(id: string, countryCode: string): Promise<void>;
  markMiniAppOpened(
    id: string,
    expectedVersion: number,
  ): Promise<VerificationSessionRecord | null>;
  beginAttempt(
    id: string,
    expectedVersion: number,
  ): Promise<VerificationSessionRecord | null>;
  resolveSession(
    id: string,
    expectedVersion: number,
    input: ResolveSessionInput,
  ): Promise<VerificationSessionRecord | null>;
  listExpiredActiveSessions(
    now: Date,
    limit?: number,
  ): Promise<VerificationSessionRecord[]>;
  listSessionsByChat(
    chatId: string,
    limit?: number,
  ): Promise<VerificationSessionRecord[]>;

  createAttempt(input: CreateAttemptInput): Promise<VerificationAttemptRecord>;
  finishAttempt(
    id: string,
    update: {
      readonly clientEvidence?: Record<string, unknown>;
      readonly analysisStatus?: GuardianProviderStatusValue;
      readonly failureReason?: string;
    },
  ): Promise<VerificationAttemptRecord>;
  listAttemptsBySession(
    sessionId: string,
  ): Promise<VerificationAttemptRecord[]>;

  createMedia(input: CreateMediaInput): Promise<VerificationMediaRecord>;
  findMediaById(id: string): Promise<VerificationMediaRecord | null>;
  findMediaBySha256(sha256: string): Promise<VerificationMediaRecord[]>;
  listMediaBySession(sessionId: string): Promise<VerificationMediaRecord[]>;
  listExpiredMedia(
    now: Date,
    limit?: number,
  ): Promise<VerificationMediaRecord[]>;
  markMediaDeleted(id: string): Promise<void>;
  /** Sessions whose STAFF report message has passed its own retention
   * deadline and still has a message id to delete. Driven by the session's
   * `staffReportDeleteAfter` (not the media cursor) so it covers BOTH photo
   * reports and no-media text reports, and can never be orphaned by the media
   * cleanup marking a row deleted first. */
  listSessionsWithExpiredStaffReport(
    now: Date,
    limit?: number,
  ): Promise<VerificationSessionRecord[]>;
  /** Clears `staffReportMessageId` after the worker has deleted that
   * Telegram message (or confirmed it no longer needs deleting) — makes
   * retention cleanup of the STAFF report message idempotent across runs. */
  clearStaffReportMessageId(sessionId: string): Promise<void>;

  upsertAnalysis(input: UpsertAnalysisInput): Promise<void>;
  getAnalysisByAttempt(
    attemptId: string,
  ): Promise<Record<string, unknown> | null>;

  createStaffDecision(
    input: CreateStaffDecisionInput,
  ): Promise<StaffDecisionRecord>;
  listStaffDecisions(sessionId: string): Promise<StaffDecisionRecord[]>;
  resolveBotTokenForTenant(
    tenantId: string,
    primaryToken: string | undefined,
    managedBotTokenKey: string | undefined,
  ): Promise<string | undefined>;
}

const asStringArray = (value: unknown): readonly string[] | null =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : null;

const toSettingsState = (row: {
  enabled: boolean;
  mode: string;
  staffChatId: bigint | null;
  staffThreadId: number | null;
  captureMode: string;
  challengeDifficulty: string;
  enabledChallenges: unknown;
  maxAttempts: number;
  sessionTtlSeconds: number;
  mediaRetentionHours: number;
  autoApproveThreshold: number;
  manualReviewThreshold: number;
  livenessMinimum: number;
  gestureMinimum: number;
  replayRiskMaximum: number;
  syntheticRiskMaximum: number;
  requireSingleFace: boolean;
  estimateAge: boolean;
  minimumAge: number | null;
  maximumAge: number | null;
  requiredPhotos: number;
  allowedCountries: string[];
  allowAutomaticDecline: boolean;
  sendApprovedCasesToStaff: boolean;
  protectStaffContent: boolean;
  locale: string;
}): GuardianSettingsState => ({
  enabled: row.enabled,
  mode: row.mode as GuardianModeValue,
  staffChatId: row.staffChatId,
  staffThreadId: row.staffThreadId,
  captureMode: row.captureMode as GuardianCaptureModeValue,
  challengeDifficulty:
    row.challengeDifficulty as GuardianChallengeDifficultyValue,
  enabledChallenges: asStringArray(row.enabledChallenges),
  maxAttempts: row.maxAttempts,
  sessionTtlSeconds: row.sessionTtlSeconds,
  mediaRetentionHours: row.mediaRetentionHours,
  autoApproveThreshold: row.autoApproveThreshold,
  manualReviewThreshold: row.manualReviewThreshold,
  livenessMinimum: row.livenessMinimum,
  gestureMinimum: row.gestureMinimum,
  replayRiskMaximum: row.replayRiskMaximum,
  syntheticRiskMaximum: row.syntheticRiskMaximum,
  requireSingleFace: row.requireSingleFace,
  estimateAge: row.estimateAge,
  minimumAge: row.minimumAge,
  maximumAge: row.maximumAge,
  requiredPhotos: row.requiredPhotos,
  allowedCountries: row.allowedCountries,
  allowAutomaticDecline: row.allowAutomaticDecline,
  sendApprovedCasesToStaff: row.sendApprovedCasesToStaff,
  protectStaffContent: row.protectStaffContent,
  locale: row.locale,
});

const toSessionRecord = (row: {
  id: string;
  tenantId: string;
  chatId: string;
  telegramChatId: bigint;
  telegramUserId: bigint;
  userChatId: bigint | null;
  joinRequestQueryIdEncrypted: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  inviteLinkName: string | null;
  countryCode: string | null;
  status: string;
  decision: string | null;
  decisionReason: string | null;
  decisionPayload: unknown;
  mode: string;
  challengeDefinition: unknown;
  challengeNonce: string;
  sessionTokenHash: string;
  expiresAt: Date;
  attemptCount: number;
  createdAt: Date;
  completedAt: Date | null;
  resolvedAt: Date | null;
  staffChatId: bigint | null;
  staffMessageId: number | null;
  staffReportMessageId: number | null;
  staffReportDeleteAfter: Date | null;
  version: number;
  idempotencyKey: string | null;
}): VerificationSessionRecord => ({
  id: row.id,
  tenantId: row.tenantId,
  chatId: row.chatId,
  telegramChatId: row.telegramChatId,
  telegramUserId: row.telegramUserId,
  userChatId: row.userChatId,
  joinRequestQueryIdEncrypted: row.joinRequestQueryIdEncrypted,
  username: row.username,
  firstName: row.firstName,
  lastName: row.lastName,
  inviteLinkName: row.inviteLinkName,
  countryCode: row.countryCode,
  status: row.status as GuardianSessionStatusValue,
  decision: row.decision as GuardianDecisionValue | null,
  decisionReason: row.decisionReason,
  decisionPayload: row.decisionPayload,
  mode: row.mode as GuardianModeValue,
  challengeDefinition: row.challengeDefinition,
  challengeNonce: row.challengeNonce,
  sessionTokenHash: row.sessionTokenHash,
  expiresAt: row.expiresAt,
  attemptCount: row.attemptCount,
  createdAt: row.createdAt,
  completedAt: row.completedAt,
  resolvedAt: row.resolvedAt,
  staffChatId: row.staffChatId,
  staffMessageId: row.staffMessageId,
  staffReportMessageId: row.staffReportMessageId,
  staffReportDeleteAfter: row.staffReportDeleteAfter,
  version: row.version,
  idempotencyKey: row.idempotencyKey,
});

const toAttemptRecord = (row: {
  id: string;
  sessionId: string;
  attemptNumber: number;
  captureType: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  clientEvidence: unknown;
  analysisStatus: string;
  failureReason: string | null;
}): VerificationAttemptRecord => ({
  id: row.id,
  sessionId: row.sessionId,
  attemptNumber: row.attemptNumber,
  captureType: row.captureType,
  startedAt: row.startedAt,
  finishedAt: row.finishedAt,
  clientEvidence: row.clientEvidence,
  analysisStatus: row.analysisStatus as GuardianProviderStatusValue,
  failureReason: row.failureReason,
});

const toMediaRecord = (row: {
  id: string;
  sessionId: string;
  attemptId: string | null;
  objectStorageKey: string;
  thumbnailStorageKey: string | null;
  mimeDetected: string | null;
  sha256: string;
  perceptualHash: string | null;
  deleteAfter: Date;
  deletedAt: Date | null;
}): VerificationMediaRecord => ({
  id: row.id,
  sessionId: row.sessionId,
  attemptId: row.attemptId,
  objectStorageKey: row.objectStorageKey,
  thumbnailStorageKey: row.thumbnailStorageKey,
  mimeDetected: row.mimeDetected,
  sha256: row.sha256,
  perceptualHash: row.perceptualHash,
  deleteAfter: row.deleteAfter,
  deletedAt: row.deletedAt,
});

export class PrismaGuardianRepository implements GuardianRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async getSettings(
    _tenantId: string,
    chatId: string,
  ): Promise<GuardianSettingsState | null> {
    const row = await this.client.guardianVerificationSettings.findUnique({
      where: { chatId },
    });
    return row ? toSettingsState(row) : null;
  }

  async upsertSettings(
    tenantId: string,
    chatId: string,
    update: GuardianSettingsUpdate,
  ): Promise<GuardianSettingsState> {
    const data: Prisma.GuardianVerificationSettingsUncheckedCreateInput = {
      tenantId,
      chatId,
      ...(update.enabled !== undefined ? { enabled: update.enabled } : {}),
      ...(update.mode !== undefined ? { mode: update.mode } : {}),
      ...(update.staffChatId !== undefined
        ? { staffChatId: update.staffChatId }
        : {}),
      ...(update.staffThreadId !== undefined
        ? { staffThreadId: update.staffThreadId }
        : {}),
      ...(update.captureMode !== undefined
        ? { captureMode: update.captureMode }
        : {}),
      ...(update.challengeDifficulty !== undefined
        ? { challengeDifficulty: update.challengeDifficulty }
        : {}),
      ...(update.enabledChallenges !== undefined
        ? {
            enabledChallenges:
              update.enabledChallenges as Prisma.InputJsonValue,
          }
        : {}),
      ...(update.maxAttempts !== undefined
        ? { maxAttempts: update.maxAttempts }
        : {}),
      ...(update.sessionTtlSeconds !== undefined
        ? { sessionTtlSeconds: update.sessionTtlSeconds }
        : {}),
      ...(update.mediaRetentionHours !== undefined
        ? { mediaRetentionHours: update.mediaRetentionHours }
        : {}),
      ...(update.autoApproveThreshold !== undefined
        ? { autoApproveThreshold: update.autoApproveThreshold }
        : {}),
      ...(update.manualReviewThreshold !== undefined
        ? { manualReviewThreshold: update.manualReviewThreshold }
        : {}),
      ...(update.livenessMinimum !== undefined
        ? { livenessMinimum: update.livenessMinimum }
        : {}),
      ...(update.gestureMinimum !== undefined
        ? { gestureMinimum: update.gestureMinimum }
        : {}),
      ...(update.replayRiskMaximum !== undefined
        ? { replayRiskMaximum: update.replayRiskMaximum }
        : {}),
      ...(update.syntheticRiskMaximum !== undefined
        ? { syntheticRiskMaximum: update.syntheticRiskMaximum }
        : {}),
      ...(update.requireSingleFace !== undefined
        ? { requireSingleFace: update.requireSingleFace }
        : {}),
      ...(update.estimateAge !== undefined
        ? { estimateAge: update.estimateAge }
        : {}),
      ...(update.minimumAge !== undefined
        ? { minimumAge: update.minimumAge }
        : {}),
      ...(update.maximumAge !== undefined
        ? { maximumAge: update.maximumAge }
        : {}),
      ...(update.requiredPhotos !== undefined
        ? { requiredPhotos: update.requiredPhotos }
        : {}),
      ...(update.allowedCountries !== undefined
        ? { allowedCountries: [...update.allowedCountries] }
        : {}),
      ...(update.allowAutomaticDecline !== undefined
        ? { allowAutomaticDecline: update.allowAutomaticDecline }
        : {}),
      ...(update.sendApprovedCasesToStaff !== undefined
        ? { sendApprovedCasesToStaff: update.sendApprovedCasesToStaff }
        : {}),
      ...(update.protectStaffContent !== undefined
        ? { protectStaffContent: update.protectStaffContent }
        : {}),
      ...(update.locale !== undefined ? { locale: update.locale } : {}),
    };
    const { tenantId: _t, chatId: _c, ...updateData } = data;
    const row = await this.client.guardianVerificationSettings.upsert({
      where: { chatId },
      create: data,
      update: updateData,
    });
    return toSettingsState(row);
  }

  async createSession(
    input: CreateVerificationSessionInput,
  ): Promise<VerificationSessionRecord | null> {
    try {
      const row = await this.client.verificationSession.create({
        data: {
          tenantId: input.tenantId,
          chatId: input.chatId,
          telegramChatId: input.telegramChatId,
          telegramUserId: input.telegramUserId,
          mode: input.mode,
          challengeDefinition:
            input.challengeDefinition as Prisma.InputJsonValue,
          challengeNonce: input.challengeNonce,
          sessionTokenHash: input.sessionTokenHash,
          expiresAt: input.expiresAt,
          idempotencyKey: input.idempotencyKey,
          ...(input.userChatId !== undefined
            ? { userChatId: input.userChatId }
            : {}),
          ...(input.joinRequestQueryIdEncrypted !== undefined
            ? { joinRequestQueryIdEncrypted: input.joinRequestQueryIdEncrypted }
            : {}),
          ...(input.username !== undefined ? { username: input.username } : {}),
          ...(input.firstName !== undefined
            ? { firstName: input.firstName }
            : {}),
          ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
          ...(input.languageCode !== undefined
            ? { languageCode: input.languageCode }
            : {}),
          ...(input.inviteLinkName !== undefined
            ? { inviteLinkName: input.inviteLinkName }
            : {}),
        },
      });
      return toSessionRecord(row);
    } catch (error) {
      // P2002 = unique constraint violation on idempotencyKey: an active
      // session already exists for this (chatId, telegramUserId) pair — a
      // retried webhook/update must not create a second one.
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
      ) {
        return null;
      }
      throw error;
    }
  }

  async findSessionByTokenHash(
    sessionTokenHash: string,
  ): Promise<VerificationSessionRecord | null> {
    const row = await this.client.verificationSession.findUnique({
      where: { sessionTokenHash },
    });
    return row ? toSessionRecord(row) : null;
  }

  async findActiveSession(
    chatId: string,
    telegramUserId: bigint,
  ): Promise<VerificationSessionRecord | null> {
    const row = await this.client.verificationSession.findFirst({
      where: {
        chatId,
        telegramUserId,
        status: {
          in: [
            "pending",
            "miniapp_opened",
            "capturing",
            "analyzing",
            "awaiting_retry",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return row ? toSessionRecord(row) : null;
  }

  async findSessionById(id: string): Promise<VerificationSessionRecord | null> {
    const row = await this.client.verificationSession.findUnique({
      where: { id },
    });
    return row ? toSessionRecord(row) : null;
  }

  async setSessionCountryIfUnset(
    id: string,
    countryCode: string,
  ): Promise<void> {
    // where: countryCode: null makes this naturally idempotent/first-write-
    // wins — no optimistic-lock version bump needed, so it never races with
    // (or gets blocked by) the session's normal status transitions.
    await this.client.verificationSession.updateMany({
      where: { id, countryCode: null },
      data: { countryCode },
    });
  }

  async markMiniAppOpened(
    id: string,
    expectedVersion: number,
  ): Promise<VerificationSessionRecord | null> {
    const result = await this.client.verificationSession.updateMany({
      where: { id, version: expectedVersion },
      data: { status: "miniapp_opened", version: { increment: 1 } },
    });
    if (result.count === 0) {
      return null;
    }
    return this.findSessionById(id);
  }

  async beginAttempt(
    id: string,
    expectedVersion: number,
  ): Promise<VerificationSessionRecord | null> {
    const result = await this.client.verificationSession.updateMany({
      where: { id, version: expectedVersion },
      data: {
        status: "capturing",
        version: { increment: 1 },
        attemptCount: { increment: 1 },
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.findSessionById(id);
  }

  async resolveSession(
    id: string,
    expectedVersion: number,
    input: ResolveSessionInput,
  ): Promise<VerificationSessionRecord | null> {
    const result = await this.client.verificationSession.updateMany({
      where: { id, version: expectedVersion },
      data: {
        status: input.status,
        version: { increment: 1 },
        ...(input.decision !== undefined ? { decision: input.decision } : {}),
        ...(input.decisionReason !== undefined
          ? { decisionReason: input.decisionReason }
          : {}),
        ...(input.decisionPayload !== undefined
          ? { decisionPayload: input.decisionPayload as Prisma.InputJsonValue }
          : {}),
        ...(input.resolvedAt !== undefined
          ? { resolvedAt: input.resolvedAt }
          : {}),
        ...(input.completedAt !== undefined
          ? { completedAt: input.completedAt }
          : {}),
        ...(input.clearIdempotencyKey ? { idempotencyKey: null } : {}),
        ...(input.clearQueryId ? { joinRequestQueryIdEncrypted: null } : {}),
        ...(input.staffChatId !== undefined
          ? { staffChatId: input.staffChatId }
          : {}),
        ...(input.staffMessageId !== undefined
          ? { staffMessageId: input.staffMessageId }
          : {}),
        ...(input.staffReportMessageId !== undefined
          ? { staffReportMessageId: input.staffReportMessageId }
          : {}),
        ...(input.staffReportDeleteAfter !== undefined
          ? { staffReportDeleteAfter: input.staffReportDeleteAfter }
          : {}),
        ...(input.sessionTokenHash !== undefined
          ? { sessionTokenHash: input.sessionTokenHash }
          : {}),
        ...(input.expiresAt !== undefined
          ? { expiresAt: input.expiresAt }
          : {}),
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.findSessionById(id);
  }

  async listExpiredActiveSessions(
    now: Date,
    limit = 100,
  ): Promise<VerificationSessionRecord[]> {
    const rows = await this.client.verificationSession.findMany({
      where: {
        expiresAt: { lte: now },
        status: {
          in: [
            "pending",
            "miniapp_opened",
            "capturing",
            "analyzing",
            "awaiting_retry",
          ],
        },
      },
      take: limit,
    });
    return rows.map(toSessionRecord);
  }

  async listSessionsByChat(
    chatId: string,
    limit = 20,
  ): Promise<VerificationSessionRecord[]> {
    const rows = await this.client.verificationSession.findMany({
      where: { chatId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(toSessionRecord);
  }

  async createAttempt(
    input: CreateAttemptInput,
  ): Promise<VerificationAttemptRecord> {
    const row = await this.client.verificationAttempt.create({
      data: {
        sessionId: input.sessionId,
        attemptNumber: input.attemptNumber,
        captureType: input.captureType,
        startedAt: new Date(),
      },
    });
    return toAttemptRecord(row);
  }

  async finishAttempt(
    id: string,
    update: {
      readonly clientEvidence?: Record<string, unknown>;
      readonly analysisStatus?: GuardianProviderStatusValue;
      readonly failureReason?: string;
    },
  ): Promise<VerificationAttemptRecord> {
    const row = await this.client.verificationAttempt.update({
      where: { id },
      data: {
        finishedAt: new Date(),
        ...(update.clientEvidence !== undefined
          ? { clientEvidence: update.clientEvidence as Prisma.InputJsonValue }
          : {}),
        ...(update.analysisStatus !== undefined
          ? { analysisStatus: update.analysisStatus }
          : {}),
        ...(update.failureReason !== undefined
          ? { failureReason: update.failureReason }
          : {}),
      },
    });
    return toAttemptRecord(row);
  }

  async listAttemptsBySession(
    sessionId: string,
  ): Promise<VerificationAttemptRecord[]> {
    const rows = await this.client.verificationAttempt.findMany({
      where: { sessionId },
      orderBy: { attemptNumber: "asc" },
    });
    return rows.map(toAttemptRecord);
  }

  async createMedia(input: CreateMediaInput): Promise<VerificationMediaRecord> {
    const row = await this.client.verificationMedia.create({
      data: {
        sessionId: input.sessionId,
        objectStorageKey: input.objectStorageKey,
        sha256: input.sha256,
        deleteAfter: input.deleteAfter,
        ...(input.attemptId !== undefined
          ? { attemptId: input.attemptId }
          : {}),
        ...(input.thumbnailStorageKey !== undefined
          ? { thumbnailStorageKey: input.thumbnailStorageKey }
          : {}),
        ...(input.mimeDetected !== undefined
          ? { mimeDetected: input.mimeDetected }
          : {}),
        ...(input.mimeDeclared !== undefined
          ? { mimeDeclared: input.mimeDeclared }
          : {}),
        ...(input.sizeBytes !== undefined
          ? { sizeBytes: input.sizeBytes }
          : {}),
        ...(input.width !== undefined ? { width: input.width } : {}),
        ...(input.height !== undefined ? { height: input.height } : {}),
        ...(input.durationMs !== undefined
          ? { durationMs: input.durationMs }
          : {}),
        ...(input.fps !== undefined ? { fps: input.fps } : {}),
        ...(input.codec !== undefined ? { codec: input.codec } : {}),
        ...(input.perceptualHash !== undefined
          ? { perceptualHash: input.perceptualHash }
          : {}),
      },
    });
    return toMediaRecord(row);
  }

  async findMediaById(id: string): Promise<VerificationMediaRecord | null> {
    const row = await this.client.verificationMedia.findUnique({
      where: { id },
    });
    return row ? toMediaRecord(row) : null;
  }

  async findMediaBySha256(sha256: string): Promise<VerificationMediaRecord[]> {
    const rows = await this.client.verificationMedia.findMany({
      where: { sha256 },
    });
    return rows.map(toMediaRecord);
  }

  async listMediaBySession(
    sessionId: string,
  ): Promise<VerificationMediaRecord[]> {
    const rows = await this.client.verificationMedia.findMany({
      where: { sessionId },
    });
    return rows.map(toMediaRecord);
  }

  async listExpiredMedia(
    now: Date,
    limit = 200,
  ): Promise<VerificationMediaRecord[]> {
    const rows = await this.client.verificationMedia.findMany({
      where: { deleteAfter: { lte: now }, deletedAt: null },
      take: limit,
    });
    return rows.map(toMediaRecord);
  }

  async listSessionsWithExpiredStaffReport(
    now: Date,
    limit = 200,
  ): Promise<VerificationSessionRecord[]> {
    const rows = await this.client.verificationSession.findMany({
      where: {
        staffReportMessageId: { not: null },
        staffChatId: { not: null },
        staffReportDeleteAfter: { lte: now },
      },
      take: limit,
    });
    return rows.map(toSessionRecord);
  }

  async markMediaDeleted(id: string): Promise<void> {
    await this.client.verificationMedia.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async clearStaffReportMessageId(sessionId: string): Promise<void> {
    await this.client.verificationSession.update({
      where: { id: sessionId },
      data: { staffReportMessageId: null },
    });
  }

  async upsertAnalysis(input: UpsertAnalysisInput): Promise<void> {
    const data: Record<string, unknown> = {
      ...(input.faceCount !== undefined ? { faceCount: input.faceCount } : {}),
      ...(input.faceConfidence !== undefined
        ? { faceConfidence: input.faceConfidence }
        : {}),
      ...(input.gestureRequested !== undefined
        ? { gestureRequested: input.gestureRequested }
        : {}),
      ...(input.gestureDetected !== undefined
        ? { gestureDetected: input.gestureDetected }
        : {}),
      ...(input.gestureScore !== undefined
        ? { gestureScore: input.gestureScore }
        : {}),
      ...(input.headMovementRequested !== undefined
        ? { headMovementRequested: input.headMovementRequested }
        : {}),
      ...(input.headMovementDetected !== undefined
        ? { headMovementDetected: input.headMovementDetected }
        : {}),
      ...(input.headMovementScore !== undefined
        ? { headMovementScore: input.headMovementScore }
        : {}),
      ...(input.blinkRequested !== undefined
        ? { blinkRequested: input.blinkRequested }
        : {}),
      ...(input.blinkDetected !== undefined
        ? { blinkDetected: input.blinkDetected }
        : {}),
      ...(input.livenessScore !== undefined
        ? { livenessScore: input.livenessScore }
        : {}),
      ...(input.livenessStatus !== undefined
        ? { livenessStatus: input.livenessStatus }
        : {}),
      ...(input.replayRisk !== undefined
        ? { replayRisk: input.replayRisk }
        : {}),
      ...(input.screenReplayRisk !== undefined
        ? { screenReplayRisk: input.screenReplayRisk }
        : {}),
      ...(input.syntheticMediaRisk !== undefined
        ? { syntheticMediaRisk: input.syntheticMediaRisk }
        : {}),
      ...(input.syntheticStatus !== undefined
        ? { syntheticStatus: input.syntheticStatus }
        : {}),
      ...(input.provenanceStatus !== undefined
        ? { provenanceStatus: input.provenanceStatus }
        : {}),
      ...(input.estimatedAgeMin !== undefined
        ? { estimatedAgeMin: input.estimatedAgeMin }
        : {}),
      ...(input.estimatedAgeMax !== undefined
        ? { estimatedAgeMax: input.estimatedAgeMax }
        : {}),
      ...(input.ageConfidence !== undefined
        ? { ageConfidence: input.ageConfidence }
        : {}),
      ...(input.ageStatus !== undefined ? { ageStatus: input.ageStatus } : {}),
      ...(input.qualityScore !== undefined
        ? { qualityScore: input.qualityScore }
        : {}),
      ...(input.lightingScore !== undefined
        ? { lightingScore: input.lightingScore }
        : {}),
      ...(input.hardFailures !== undefined
        ? {
            hardFailures:
              input.hardFailures as unknown as Prisma.InputJsonValue,
          }
        : {}),
      ...(input.warnings !== undefined
        ? { warnings: input.warnings as unknown as Prisma.InputJsonValue }
        : {}),
      ...(input.modelVersions !== undefined
        ? { modelVersions: input.modelVersions as Prisma.InputJsonValue }
        : {}),
      ...(input.analysisDurationMs !== undefined
        ? { analysisDurationMs: input.analysisDurationMs }
        : {}),
      ...(input.rawTechnicalReport !== undefined
        ? {
            rawTechnicalReport:
              input.rawTechnicalReport as Prisma.InputJsonValue,
          }
        : {}),
    };
    await this.client.verificationAnalysis.upsert({
      where: { attemptId: input.attemptId },
      create: {
        attemptId: input.attemptId,
        ...data,
      } as Prisma.VerificationAnalysisUncheckedCreateInput,
      update: data as Prisma.VerificationAnalysisUncheckedUpdateInput,
    });
  }

  async getAnalysisByAttempt(
    attemptId: string,
  ): Promise<Record<string, unknown> | null> {
    const row = await this.client.verificationAnalysis.findUnique({
      where: { attemptId },
    });
    return row as unknown as Record<string, unknown> | null;
  }

  async createStaffDecision(
    input: CreateStaffDecisionInput,
  ): Promise<StaffDecisionRecord> {
    const row = await this.client.staffDecision.create({
      data: {
        sessionId: input.sessionId,
        moderatorTelegramId: input.moderatorTelegramId,
        action: input.action,
        ...(input.reason !== undefined ? { reason: input.reason } : {}),
      },
    });
    return {
      id: row.id,
      sessionId: row.sessionId,
      moderatorTelegramId: row.moderatorTelegramId,
      action: row.action as GuardianStaffActionValue,
      reason: row.reason,
      createdAt: row.createdAt,
    };
  }

  /**
   * Resolves which bot token a Guardian session's tenant is actually served
   * by: the primary bot's own tenant has no ManagedBot row (or a bookkeeping
   * one with isPrimary=true) and uses `primaryToken` straight from env; any
   * other tenant is a managed child bot whose token is decrypted on demand.
   * Never caches the decrypted token — callers should use it and discard it.
   */
  async resolveBotTokenForTenant(
    tenantId: string,
    primaryToken: string | undefined,
    managedBotTokenKey: string | undefined,
  ): Promise<string | undefined> {
    const bot = await this.client.managedBot.findFirst({ where: { tenantId } });
    if (!bot || bot.isPrimary) {
      return primaryToken;
    }
    if (bot.status !== "active" || !bot.encryptedToken) {
      return undefined;
    }
    if (!managedBotTokenKey) {
      throw new Error("missing-managed-bot-token-key");
    }
    return decryptManagedBotToken(bot.encryptedToken, managedBotTokenKey);
  }

  async listStaffDecisions(sessionId: string): Promise<StaffDecisionRecord[]> {
    const rows = await this.client.staffDecision.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      sessionId: row.sessionId,
      moderatorTelegramId: row.moderatorTelegramId,
      action: row.action as GuardianStaffActionValue,
      reason: row.reason,
      createdAt: row.createdAt,
    }));
  }
}

let inMemoryIdCounter = 0;
const nextInMemoryId = (prefix: string): string => {
  inMemoryIdCounter += 1;
  return `${prefix}_${inMemoryIdCounter}`;
};

const ACTIVE_SESSION_STATUSES: ReadonlySet<GuardianSessionStatusValue> =
  new Set([
    "pending",
    "miniapp_opened",
    "capturing",
    "analyzing",
    "awaiting_retry",
  ]);

/** In-memory GuardianRepository — the default for tests and for any
 * BotUpdateService constructor param DI can't resolve (mirrors the
 * InMemory*Repository pattern used throughout this file, e.g.
 * InMemoryChatSettingRepository below). Never used in production: the real
 * app wires PrismaGuardianRepository via the GUARDIAN_REPOSITORY DI token. */
export class InMemoryGuardianRepository implements GuardianRepository {
  private readonly settings = new Map<string, GuardianSettingsState>();
  private readonly sessions = new Map<string, VerificationSessionRecord>();
  private readonly attempts = new Map<string, VerificationAttemptRecord>();
  private readonly media = new Map<string, VerificationMediaRecord>();
  private readonly analyses = new Map<string, Record<string, unknown>>();
  private readonly staffDecisions = new Map<string, StaffDecisionRecord>();

  async getSettings(
    _tenantId: string,
    chatId: string,
  ): Promise<GuardianSettingsState | null> {
    return this.settings.get(chatId) ?? null;
  }

  async upsertSettings(
    _tenantId: string,
    chatId: string,
    update: GuardianSettingsUpdate,
  ): Promise<GuardianSettingsState> {
    const current: GuardianSettingsState = this.settings.get(chatId) ?? {
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
    const merged: GuardianSettingsState = { ...current, ...update };
    this.settings.set(chatId, merged);
    return merged;
  }

  async createSession(
    input: CreateVerificationSessionInput,
  ): Promise<VerificationSessionRecord | null> {
    const activeExists = [...this.sessions.values()].some(
      (s) =>
        s.chatId === input.chatId &&
        s.telegramUserId === input.telegramUserId &&
        ACTIVE_SESSION_STATUSES.has(s.status),
    );
    if (activeExists) {
      return null;
    }
    const record: VerificationSessionRecord = {
      id: nextInMemoryId("session"),
      tenantId: input.tenantId,
      chatId: input.chatId,
      telegramChatId: input.telegramChatId,
      telegramUserId: input.telegramUserId,
      userChatId: input.userChatId ?? null,
      joinRequestQueryIdEncrypted: input.joinRequestQueryIdEncrypted ?? null,
      username: input.username ?? null,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      inviteLinkName: input.inviteLinkName ?? null,
      countryCode: null,
      status: "pending",
      decision: null,
      decisionReason: null,
      decisionPayload: null,
      mode: input.mode,
      challengeDefinition: input.challengeDefinition,
      challengeNonce: input.challengeNonce,
      sessionTokenHash: input.sessionTokenHash,
      expiresAt: input.expiresAt,
      attemptCount: 0,
      createdAt: new Date(),
      completedAt: null,
      resolvedAt: null,
      staffChatId: null,
      staffMessageId: null,
      staffReportMessageId: null,
      staffReportDeleteAfter: null,
      version: 1,
      idempotencyKey: input.idempotencyKey,
    };
    this.sessions.set(record.id, record);
    return record;
  }

  async findSessionByTokenHash(
    sessionTokenHash: string,
  ): Promise<VerificationSessionRecord | null> {
    return (
      [...this.sessions.values()].find(
        (s) => s.sessionTokenHash === sessionTokenHash,
      ) ?? null
    );
  }

  async findActiveSession(
    chatId: string,
    telegramUserId: bigint,
  ): Promise<VerificationSessionRecord | null> {
    return (
      [...this.sessions.values()]
        .filter(
          (s) =>
            s.chatId === chatId &&
            s.telegramUserId === telegramUserId &&
            ACTIVE_SESSION_STATUSES.has(s.status),
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ??
      null
    );
  }

  async findSessionById(id: string): Promise<VerificationSessionRecord | null> {
    return this.sessions.get(id) ?? null;
  }

  async setSessionCountryIfUnset(
    id: string,
    countryCode: string,
  ): Promise<void> {
    const session = this.sessions.get(id);
    if (!session || session.countryCode !== null) {
      return;
    }
    this.sessions.set(id, { ...session, countryCode });
  }

  async markMiniAppOpened(
    id: string,
    expectedVersion: number,
  ): Promise<VerificationSessionRecord | null> {
    const session = this.sessions.get(id);
    if (!session || session.version !== expectedVersion) {
      return null;
    }
    const updated: VerificationSessionRecord = {
      ...session,
      status: "miniapp_opened",
      version: session.version + 1,
    };
    this.sessions.set(id, updated);
    return updated;
  }

  async beginAttempt(
    id: string,
    expectedVersion: number,
  ): Promise<VerificationSessionRecord | null> {
    const session = this.sessions.get(id);
    if (!session || session.version !== expectedVersion) {
      return null;
    }
    const updated: VerificationSessionRecord = {
      ...session,
      status: "capturing",
      version: session.version + 1,
      attemptCount: session.attemptCount + 1,
    };
    this.sessions.set(id, updated);
    return updated;
  }

  async resolveSession(
    id: string,
    expectedVersion: number,
    input: ResolveSessionInput,
  ): Promise<VerificationSessionRecord | null> {
    const session = this.sessions.get(id);
    if (!session || session.version !== expectedVersion) {
      return null;
    }
    const updated: VerificationSessionRecord = {
      ...session,
      status: input.status,
      version: session.version + 1,
      decision: input.decision ?? session.decision,
      decisionReason: input.decisionReason ?? session.decisionReason,
      decisionPayload: input.decisionPayload ?? session.decisionPayload,
      resolvedAt: input.resolvedAt ?? session.resolvedAt,
      completedAt: input.completedAt ?? session.completedAt,
      idempotencyKey: input.clearIdempotencyKey ? null : session.idempotencyKey,
      joinRequestQueryIdEncrypted: input.clearQueryId
        ? null
        : session.joinRequestQueryIdEncrypted,
      staffChatId: input.staffChatId ?? session.staffChatId,
      staffMessageId: input.staffMessageId ?? session.staffMessageId,
      staffReportMessageId:
        input.staffReportMessageId ?? session.staffReportMessageId,
      staffReportDeleteAfter:
        input.staffReportDeleteAfter ?? session.staffReportDeleteAfter,
      sessionTokenHash: input.sessionTokenHash ?? session.sessionTokenHash,
      expiresAt: input.expiresAt ?? session.expiresAt,
    };
    this.sessions.set(id, updated);
    return updated;
  }

  async listExpiredActiveSessions(
    now: Date,
    limit = 100,
  ): Promise<VerificationSessionRecord[]> {
    return [...this.sessions.values()]
      .filter(
        (s) =>
          s.expiresAt.getTime() <= now.getTime() &&
          ACTIVE_SESSION_STATUSES.has(s.status),
      )
      .slice(0, limit);
  }

  async listSessionsByChat(
    chatId: string,
    limit = 20,
  ): Promise<VerificationSessionRecord[]> {
    return [...this.sessions.values()]
      .filter((s) => s.chatId === chatId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async createAttempt(
    input: CreateAttemptInput,
  ): Promise<VerificationAttemptRecord> {
    const record: VerificationAttemptRecord = {
      id: nextInMemoryId("attempt"),
      sessionId: input.sessionId,
      attemptNumber: input.attemptNumber,
      captureType: input.captureType,
      startedAt: new Date(),
      finishedAt: null,
      clientEvidence: null,
      analysisStatus: "not_evaluated",
      failureReason: null,
    };
    this.attempts.set(record.id, record);
    return record;
  }

  async finishAttempt(
    id: string,
    update: {
      readonly clientEvidence?: Record<string, unknown>;
      readonly analysisStatus?: GuardianProviderStatusValue;
      readonly failureReason?: string;
    },
  ): Promise<VerificationAttemptRecord> {
    const attempt = this.attempts.get(id);
    if (!attempt) {
      throw new Error("attempt-not-found");
    }
    const updated: VerificationAttemptRecord = {
      ...attempt,
      finishedAt: new Date(),
      clientEvidence: update.clientEvidence ?? attempt.clientEvidence,
      analysisStatus: update.analysisStatus ?? attempt.analysisStatus,
      failureReason: update.failureReason ?? attempt.failureReason,
    };
    this.attempts.set(id, updated);
    return updated;
  }

  async listAttemptsBySession(
    sessionId: string,
  ): Promise<VerificationAttemptRecord[]> {
    return [...this.attempts.values()]
      .filter((a) => a.sessionId === sessionId)
      .sort((a, b) => a.attemptNumber - b.attemptNumber);
  }

  async createMedia(input: CreateMediaInput): Promise<VerificationMediaRecord> {
    const record: VerificationMediaRecord = {
      id: nextInMemoryId("media"),
      sessionId: input.sessionId,
      attemptId: input.attemptId ?? null,
      objectStorageKey: input.objectStorageKey,
      thumbnailStorageKey: input.thumbnailStorageKey ?? null,
      mimeDetected: input.mimeDetected ?? null,
      sha256: input.sha256,
      perceptualHash: input.perceptualHash ?? null,
      deleteAfter: input.deleteAfter,
      deletedAt: null,
    };
    this.media.set(record.id, record);
    return record;
  }

  async findMediaById(id: string): Promise<VerificationMediaRecord | null> {
    return this.media.get(id) ?? null;
  }

  async findMediaBySha256(sha256: string): Promise<VerificationMediaRecord[]> {
    return [...this.media.values()].filter((m) => m.sha256 === sha256);
  }

  async listMediaBySession(
    sessionId: string,
  ): Promise<VerificationMediaRecord[]> {
    return [...this.media.values()].filter((m) => m.sessionId === sessionId);
  }

  async listExpiredMedia(
    now: Date,
    limit = 200,
  ): Promise<VerificationMediaRecord[]> {
    return [...this.media.values()]
      .filter((m) => m.deleteAfter.getTime() <= now.getTime() && !m.deletedAt)
      .slice(0, limit);
  }

  async listSessionsWithExpiredStaffReport(
    now: Date,
    limit = 200,
  ): Promise<VerificationSessionRecord[]> {
    return [...this.sessions.values()]
      .filter(
        (s) =>
          s.staffReportMessageId !== null &&
          s.staffChatId !== null &&
          s.staffReportDeleteAfter !== null &&
          s.staffReportDeleteAfter.getTime() <= now.getTime(),
      )
      .slice(0, limit);
  }

  async markMediaDeleted(id: string): Promise<void> {
    const media = this.media.get(id);
    if (media) {
      this.media.set(id, { ...media, deletedAt: new Date() });
    }
  }

  async clearStaffReportMessageId(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.set(sessionId, { ...session, staffReportMessageId: null });
    }
  }

  async upsertAnalysis(input: UpsertAnalysisInput): Promise<void> {
    const { attemptId, ...rest } = input;
    const existing = this.analyses.get(attemptId) ?? {};
    this.analyses.set(attemptId, { ...existing, ...rest });
  }

  async getAnalysisByAttempt(
    attemptId: string,
  ): Promise<Record<string, unknown> | null> {
    return this.analyses.get(attemptId) ?? null;
  }

  async createStaffDecision(
    input: CreateStaffDecisionInput,
  ): Promise<StaffDecisionRecord> {
    const record: StaffDecisionRecord = {
      id: nextInMemoryId("staff_decision"),
      sessionId: input.sessionId,
      moderatorTelegramId: input.moderatorTelegramId,
      action: input.action,
      reason: input.reason ?? null,
      createdAt: new Date(),
    };
    this.staffDecisions.set(record.id, record);
    return record;
  }

  async listStaffDecisions(sessionId: string): Promise<StaffDecisionRecord[]> {
    return [...this.staffDecisions.values()]
      .filter((d) => d.sessionId === sessionId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async resolveBotTokenForTenant(
    _tenantId: string,
    primaryToken: string | undefined,
    _managedBotTokenKey: string | undefined,
  ): Promise<string | undefined> {
    return primaryToken;
  }
}
