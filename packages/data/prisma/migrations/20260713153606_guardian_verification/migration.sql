-- CreateEnum
CREATE TYPE "GuardianMode" AS ENUM ('off', 'manual', 'assisted', 'auto', 'strict');

-- CreateEnum
CREATE TYPE "GuardianCaptureMode" AS ENUM ('photo', 'video', 'video_with_fallback');

-- CreateEnum
CREATE TYPE "GuardianChallengeDifficulty" AS ENUM ('basic', 'normal', 'strict');

-- CreateEnum
CREATE TYPE "GuardianSessionStatus" AS ENUM ('pending', 'miniapp_opened', 'capturing', 'analyzing', 'awaiting_retry', 'resolved', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "GuardianDecision" AS ENUM ('auto_approve', 'manual_review', 'retry', 'auto_decline', 'technical_failure');

-- CreateEnum
CREATE TYPE "GuardianProviderStatus" AS ENUM ('success', 'uncertain', 'unavailable', 'failed', 'not_evaluated');

-- CreateEnum
CREATE TYPE "GuardianProvenanceStatus" AS ENUM ('c2pa_valid_ai_declared', 'c2pa_valid_other', 'c2pa_invalid', 'c2pa_not_found', 'c2pa_unavailable');

-- CreateEnum
CREATE TYPE "GuardianStaffAction" AS ENUM ('approve', 'decline', 'retry', 'delete_media', 'mark_false_positive', 'expel');

-- CreateTable
CREATE TABLE "guardian_verification_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" "GuardianMode" NOT NULL DEFAULT 'off',
    "staffChatId" BIGINT,
    "staffThreadId" INTEGER,
    "captureMode" "GuardianCaptureMode" NOT NULL DEFAULT 'video_with_fallback',
    "challengeDifficulty" "GuardianChallengeDifficulty" NOT NULL DEFAULT 'normal',
    "enabledChallenges" JSONB,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "sessionTtlSeconds" INTEGER NOT NULL DEFAULT 600,
    "mediaRetentionHours" INTEGER NOT NULL DEFAULT 72,
    "autoApproveThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "manualReviewThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.55,
    "livenessMinimum" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "gestureMinimum" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "replayRiskMaximum" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "syntheticRiskMaximum" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "requireSingleFace" BOOLEAN NOT NULL DEFAULT true,
    "estimateAge" BOOLEAN NOT NULL DEFAULT false,
    "minimumAge" INTEGER,
    "allowAutomaticDecline" BOOLEAN NOT NULL DEFAULT false,
    "sendApprovedCasesToStaff" BOOLEAN NOT NULL DEFAULT true,
    "protectStaffContent" BOOLEAN NOT NULL DEFAULT true,
    "locale" TEXT NOT NULL DEFAULT 'es',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guardian_verification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramChatId" BIGINT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "userChatId" BIGINT,
    "joinRequestQueryIdEncrypted" TEXT,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "languageCode" TEXT,
    "inviteLinkName" TEXT,
    "status" "GuardianSessionStatus" NOT NULL DEFAULT 'pending',
    "decision" "GuardianDecision",
    "decisionReason" TEXT,
    "decisionPayload" JSONB,
    "mode" "GuardianMode" NOT NULL,
    "challengeDefinition" JSONB NOT NULL,
    "challengeNonce" TEXT NOT NULL,
    "sessionTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "staffChatId" BIGINT,
    "staffMessageId" INTEGER,
    "staffReportMessageId" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" TEXT,

    CONSTRAINT "verification_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_attempts" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "captureType" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "clientEvidence" JSONB,
    "analysisStatus" "GuardianProviderStatus" NOT NULL DEFAULT 'not_evaluated',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_media" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "attemptId" TEXT,
    "objectStorageKey" TEXT NOT NULL,
    "thumbnailStorageKey" TEXT,
    "mimeDetected" TEXT,
    "mimeDeclared" TEXT,
    "sizeBytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "durationMs" INTEGER,
    "fps" DOUBLE PRECISION,
    "codec" TEXT,
    "sha256" TEXT NOT NULL,
    "perceptualHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleteAfter" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "verification_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_analyses" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "faceCount" INTEGER,
    "faceConfidence" DOUBLE PRECISION,
    "gestureRequested" TEXT,
    "gestureDetected" TEXT,
    "gestureScore" DOUBLE PRECISION,
    "headMovementRequested" TEXT,
    "headMovementDetected" TEXT,
    "headMovementScore" DOUBLE PRECISION,
    "blinkRequested" BOOLEAN,
    "blinkDetected" BOOLEAN,
    "livenessScore" DOUBLE PRECISION,
    "livenessStatus" "GuardianProviderStatus",
    "replayRisk" DOUBLE PRECISION,
    "screenReplayRisk" DOUBLE PRECISION,
    "syntheticMediaRisk" DOUBLE PRECISION,
    "syntheticStatus" "GuardianProviderStatus",
    "provenanceStatus" "GuardianProvenanceStatus",
    "estimatedAgeMin" INTEGER,
    "estimatedAgeMax" INTEGER,
    "ageConfidence" DOUBLE PRECISION,
    "ageStatus" "GuardianProviderStatus",
    "qualityScore" DOUBLE PRECISION,
    "lightingScore" DOUBLE PRECISION,
    "hardFailures" JSONB,
    "warnings" JSONB,
    "modelVersions" JSONB,
    "analysisDurationMs" INTEGER,
    "rawTechnicalReport" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_decisions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "moderatorTelegramId" BIGINT NOT NULL,
    "action" "GuardianStaffAction" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guardian_verification_settings_chatId_key" ON "guardian_verification_settings"("chatId");

-- CreateIndex
CREATE INDEX "guardian_verification_settings_tenantId_idx" ON "guardian_verification_settings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_sessions_challengeNonce_key" ON "verification_sessions"("challengeNonce");

-- CreateIndex
CREATE UNIQUE INDEX "verification_sessions_sessionTokenHash_key" ON "verification_sessions"("sessionTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "verification_sessions_idempotencyKey_key" ON "verification_sessions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "verification_sessions_tenantId_chatId_status_idx" ON "verification_sessions"("tenantId", "chatId", "status");

-- CreateIndex
CREATE INDEX "verification_sessions_tenantId_telegramUserId_idx" ON "verification_sessions"("tenantId", "telegramUserId");

-- CreateIndex
CREATE INDEX "verification_sessions_expiresAt_idx" ON "verification_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "verification_attempts_sessionId_idx" ON "verification_attempts"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_attempts_sessionId_attemptNumber_key" ON "verification_attempts"("sessionId", "attemptNumber");

-- CreateIndex
CREATE INDEX "verification_media_sessionId_idx" ON "verification_media"("sessionId");

-- CreateIndex
CREATE INDEX "verification_media_sha256_idx" ON "verification_media"("sha256");

-- CreateIndex
CREATE INDEX "verification_media_deleteAfter_idx" ON "verification_media"("deleteAfter");

-- CreateIndex
CREATE UNIQUE INDEX "verification_analyses_attemptId_key" ON "verification_analyses"("attemptId");

-- CreateIndex
CREATE INDEX "staff_decisions_sessionId_idx" ON "staff_decisions"("sessionId");

