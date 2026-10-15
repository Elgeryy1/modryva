-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('active', 'suspended', 'archived');

-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('enabled', 'disabled', 'degraded');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('user', 'bot', 'system', 'integration');

-- CreateEnum
CREATE TYPE "SanctionKind" AS ENUM ('ban', 'mute', 'restrict', 'warn', 'delete', 'lock');

-- CreateEnum
CREATE TYPE "CaptchaMode" AS ENUM ('button', 'text', 'math', 'custom');

-- CreateEnum
CREATE TYPE "PolicyAction" AS ENUM ('allow', 'warn', 'delete', 'mute', 'ban', 'review');

-- CreateEnum
CREATE TYPE "ManagedBotStatus" AS ENUM ('pending', 'active', 'suspended', 'revoked', 'failed');

-- CreateEnum
CREATE TYPE "ManagedBotTemplate" AS ENUM ('community', 'creator', 'support', 'business', 'custom');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('platform_owner', 'promo_admin', 'bot_factory_admin', 'support_admin', 'auditor');

-- CreateEnum
CREATE TYPE "EntitlementKind" AS ENUM ('managed_bot_slot', 'pro_trial', 'agency_pack');

-- CreateEnum
CREATE TYPE "EntitlementSource" AS ENUM ('promo', 'payment', 'manual');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "managed_bots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "telegramBotId" BIGINT,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "ownerTelegramId" BIGINT,
    "template" "ManagedBotTemplate" NOT NULL DEFAULT 'community',
    "status" "ManagedBotStatus" NOT NULL DEFAULT 'active',
    "encryptedToken" TEXT,
    "tokenFingerprint" TEXT,
    "tokenLastRotatedAt" TIMESTAMP(3),
    "webhookSecretHash" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "entitlementId" TEXT,
    "createdViaPromoRedemptionId" TEXT,
    "lastActivatedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "expiryWarnedAt" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "managed_bots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_role_assignments" (
    "id" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "role" "PlatformRole" NOT NULL,
    "grantedByTelegramId" BIGINT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "codeHash" TEXT NOT NULL,
    "codePrefix" TEXT NOT NULL,
    "kind" "EntitlementKind" NOT NULL,
    "template" "ManagedBotTemplate" NOT NULL DEFAULT 'community',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdByTelegramId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_redemptions" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "redeemedByTelegramId" BIGINT NOT NULL,
    "entitlementId" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "ownerTelegramId" BIGINT NOT NULL,
    "kind" "EntitlementKind" NOT NULL,
    "template" "ManagedBotTemplate" NOT NULL DEFAULT 'community',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "usedQuantity" INTEGER NOT NULL DEFAULT 0,
    "source" "EntitlementSource" NOT NULL,
    "sourceRef" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdByTelegramId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "telegramUserId" BIGINT NOT NULL,
    "username" TEXT,
    "languageCode" TEXT,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chats" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "telegramChatId" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "username" TEXT,
    "isForum" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramTopicId" INTEGER NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'es',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Madrid',
    "dateFormat" TEXT NOT NULL DEFAULT 'dd/MM/yyyy',
    "accessibility" JSONB,
    "notifications" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_bindings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "native_admin_snapshots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "native_admin_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_states" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT,
    "moduleKey" TEXT NOT NULL,
    "status" "ModuleStatus" NOT NULL DEFAULT 'disabled',
    "version" TEXT,
    "config" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "update_inbox" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "botKey" TEXT NOT NULL,
    "updateId" BIGINT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "update_inbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "callback_inbox" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "callbackId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "callback_inbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_outbox" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "topic" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "runAfter" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "actorType" "AuditActorType" NOT NULL DEFAULT 'system',
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_alerts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secrets_refs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "secrets_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privacy_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "privacy_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backups" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "storageRef" TEXT,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "backups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT,
    "key" TEXT NOT NULL,
    "value" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_cases" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT,
    "caseNumber" INTEGER NOT NULL,
    "subjectUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "reason" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moderation_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sanctions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT,
    "userId" TEXT NOT NULL,
    "kind" "SanctionKind" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "reason" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sanctions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warnings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseId" TEXT,
    "reason" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),

    CONSTRAINT "warnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT,
    "reporterUserId" TEXT,
    "subjectTelegramId" BIGINT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "storageRef" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appeals" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "message" TEXT NOT NULL,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appeals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spam_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT,
    "name" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spam_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "antiflood_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "windowSeconds" INTEGER NOT NULL DEFAULT 10,
    "messageLimit" INTEGER NOT NULL DEFAULT 5,
    "action" TEXT NOT NULL DEFAULT 'mute',
    "muteSeconds" INTEGER NOT NULL DEFAULT 300,
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 30,
    "exempt" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "antiflood_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "antiflood_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "messageCount" INTEGER NOT NULL,
    "windowSeconds" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "antiflood_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "antiraid_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "windowSeconds" INTEGER NOT NULL DEFAULT 30,
    "joinLimit" INTEGER NOT NULL DEFAULT 5,
    "mode" TEXT NOT NULL DEFAULT 'observe',
    "newAccountAgeDays" INTEGER NOT NULL DEFAULT 0,
    "underAttackUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "antiraid_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "antiraid_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "joinCount" INTEGER NOT NULL,
    "windowSeconds" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "antiraid_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_commands" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filters" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "polls" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_votes" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "optionIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XTR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "payload" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XTR',
    "status" TEXT NOT NULL DEFAULT 'created',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "productId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XTR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "provider" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "payload" JSONB NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "winnerTelegramId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_scores" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_assets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "fileUniqueId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "fileName" TEXT,
    "scanStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feeds" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramChatId" BIGINT NOT NULL,
    "url" TEXT NOT NULL,
    "lastItemGuid" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastPolledAt" TIMESTAMP(3),

    CONSTRAINT "feeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramChatId" BIGINT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "runAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firedAt" TIMESTAMP(3),

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "number" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "afk_statuses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "username" TEXT,
    "reason" TEXT,
    "since" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "afk_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "reporterTelegramId" BIGINT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "assigneeTelegramId" BIGINT,
    "number" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_posts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramChatId" BIGINT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "runAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "scheduled_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "giveaways" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "prize" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "seed" TEXT,
    "winnerTelegramId" BIGINT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "giveaways_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "giveaway_entries" (
    "id" TEXT NOT NULL,
    "giveawayId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "giveaway_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_daily" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "messages" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_activity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "username" TEXT,
    "messages" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_stats" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "inviterTelegramId" BIGINT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invite_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reputation_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reputation_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "welcome_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "welcomeText" TEXT,
    "goodbyeText" TEXT,
    "rulesText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "welcome_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_lock_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "locked" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_lock_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocklist_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocklist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocklist_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'delete',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blocklist_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warn_policy_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "warnLimit" INTEGER NOT NULL DEFAULT 3,
    "warnMode" TEXT NOT NULL DEFAULT 'mute',
    "durationMs" BIGINT,
    "expireMs" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warn_policy_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_hygiene_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "cleanService" BOOLEAN NOT NULL DEFAULT false,
    "cleanWelcome" BOOLEAN NOT NULL DEFAULT false,
    "nightMode" BOOLEAN NOT NULL DEFAULT false,
    "nightStart" INTEGER NOT NULL DEFAULT 23,
    "nightEnd" INTEGER NOT NULL DEFAULT 7,
    "welcomeMute" BOOLEAN NOT NULL DEFAULT false,
    "autoApprove" BOOLEAN NOT NULL DEFAULT false,
    "rtlFilter" BOOLEAN NOT NULL DEFAULT false,
    "cjkFilter" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'es',
    "blockKnownSpammers" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_hygiene_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_membership_gates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramChatId" BIGINT NOT NULL,
    "requiredTelegramChatId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_membership_gates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verified_users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verified_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "panel_edit_states" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "field" TEXT NOT NULL,
    "groupTelegramChatId" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "panel_edit_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffTelegramChatId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_reactions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "federations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fedId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerTelegramId" BIGINT NOT NULL,
    "logTelegramChatId" BIGINT,
    "subscribedFedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "federations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "federation_chats" (
    "id" TEXT NOT NULL,
    "fedId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramChatId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "federation_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "federation_bans" (
    "id" TEXT NOT NULL,
    "fedId" TEXT NOT NULL,
    "subjectTelegramId" BIGINT NOT NULL,
    "reason" TEXT,
    "actorTelegramId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "federation_bans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "federation_admins" (
    "id" TEXT NOT NULL,
    "fedId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "federation_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_network_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fedId" TEXT NOT NULL,
    "logTelegramChatId" BIGINT,
    "welcomeMode" TEXT NOT NULL DEFAULT 'per_group',
    "welcomeText" TEXT,
    "goodbyeText" TEXT,
    "rulesMode" TEXT NOT NULL DEFAULT 'per_group',
    "rulesText" TEXT,
    "membershipMode" TEXT NOT NULL DEFAULT 'off',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_network_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_network_group_roles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fedId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_network_group_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_network_routes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fedId" TEXT NOT NULL,
    "sourceChatId" TEXT,
    "sourceKey" TEXT NOT NULL,
    "eventKind" TEXT NOT NULL,
    "targetChatId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_network_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_network_config_snapshots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fedId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owner_network_config_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_network_user_risks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fedId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "deletedCount" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "quarantineCount" INTEGER NOT NULL DEFAULT 0,
    "linkCount" INTEGER NOT NULL DEFAULT 0,
    "sanctionCount" INTEGER NOT NULL DEFAULT 0,
    "chatIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owner_network_user_risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_network_user_roles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fedId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_network_user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_network_user_notes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fedId" TEXT NOT NULL,
    "subjectTelegramUserId" BIGINT NOT NULL,
    "authorTelegramUserId" BIGINT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owner_network_user_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_network_badges" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fedId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "badge" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owner_network_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_network_missions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fedId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "kind" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owner_network_missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_network_welcome_buttons" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "rules" BOOLEAN NOT NULL DEFAULT true,
    "otherGroups" BOOLEAN NOT NULL DEFAULT true,
    "support" BOOLEAN NOT NULL DEFAULT true,
    "verify" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_network_welcome_buttons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_network_automations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fedId" TEXT NOT NULL,
    "chatId" TEXT,
    "name" TEXT NOT NULL,
    "trigger" JSONB NOT NULL,
    "condition" JSONB NOT NULL,
    "action" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_network_automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_network_entitlements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fedId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "maxChats" INTEGER NOT NULL DEFAULT 3,
    "premiumUntil" TIMESTAMP(3),
    "grantedByCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_network_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_network_premium_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'pro',
    "maxChats" INTEGER NOT NULL DEFAULT 10,
    "days" INTEGER NOT NULL DEFAULT 30,
    "createdBy" TEXT NOT NULL,
    "redeemedBy" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owner_network_premium_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "captcha_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" "CaptchaMode" NOT NULL DEFAULT 'button',
    "timeoutSeconds" INTEGER NOT NULL DEFAULT 120,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "failAction" TEXT NOT NULL DEFAULT 'ban',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "captcha_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "captcha_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT,
    "telegramUserId" BIGINT NOT NULL,
    "mode" "CaptchaMode" NOT NULL,
    "challenge" TEXT NOT NULL,
    "answerHash" TEXT,
    "answerSalt" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "failAction" TEXT NOT NULL DEFAULT 'ban',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "captcha_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_rules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'chat',
    "action" "PolicyAction" NOT NULL,
    "pattern" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chip_wallets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "serverSeed" TEXT NOT NULL,
    "serverSeedHash" TEXT NOT NULL,
    "clientSeed" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chip_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chip_ledger" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refId" TEXT,
    "chargeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chip_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casino_duels" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "challengerId" BIGINT NOT NULL,
    "challengerName" TEXT,
    "stake" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "opponentId" BIGINT,
    "winnerId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "casino_duels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casino_bets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "game" TEXT NOT NULL,
    "stake" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "serverSeed" TEXT NOT NULL,
    "serverSeedHash" TEXT NOT NULL,
    "clientSeed" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL,
    "state" JSONB NOT NULL,
    "payout" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "casino_bets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jackpots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jackpots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "prizePool" INTEGER NOT NULL DEFAULT 0,
    "winners" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "d1_log_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "logTelegramChatId" BIGINT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "d1_log_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "d1_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "d1_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quarantine_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "strictness" TEXT NOT NULL DEFAULT 'balanced',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quarantine_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quarantine_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramChatId" BIGINT NOT NULL,
    "messageId" INTEGER,
    "actorTelegramId" BIGINT NOT NULL,
    "username" TEXT,
    "text" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" BIGINT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "quarantine_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "d1_appeals" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT,
    "caseRef" TEXT NOT NULL,
    "appellantTelegramId" BIGINT NOT NULL,
    "username" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedBy" BIGINT,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "d1_appeals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerKind" TEXT NOT NULL,
    "triggerValue" TEXT NOT NULL,
    "actionKind" TEXT NOT NULL,
    "actionValue" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "goalKind" TEXT NOT NULL,
    "goalTarget" INTEGER NOT NULL,
    "rewardBadge" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_progress" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mission_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "badgeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "managed_bots_telegramBotId_key" ON "managed_bots"("telegramBotId");

-- CreateIndex
CREATE UNIQUE INDEX "managed_bots_username_key" ON "managed_bots"("username");

-- CreateIndex
CREATE INDEX "managed_bots_tenantId_idx" ON "managed_bots"("tenantId");

-- CreateIndex
CREATE INDEX "managed_bots_ownerTelegramId_idx" ON "managed_bots"("ownerTelegramId");

-- CreateIndex
CREATE INDEX "managed_bots_status_idx" ON "managed_bots"("status");

-- CreateIndex
CREATE INDEX "platform_role_assignments_telegramUserId_idx" ON "platform_role_assignments"("telegramUserId");

-- CreateIndex
CREATE INDEX "platform_role_assignments_role_idx" ON "platform_role_assignments"("role");

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_codeHash_key" ON "promo_codes"("codeHash");

-- CreateIndex
CREATE INDEX "promo_codes_tenantId_idx" ON "promo_codes"("tenantId");

-- CreateIndex
CREATE INDEX "promo_codes_createdByTelegramId_idx" ON "promo_codes"("createdByTelegramId");

-- CreateIndex
CREATE INDEX "promo_redemptions_redeemedByTelegramId_idx" ON "promo_redemptions"("redeemedByTelegramId");

-- CreateIndex
CREATE UNIQUE INDEX "promo_redemptions_promoCodeId_redeemedByTelegramId_key" ON "promo_redemptions"("promoCodeId", "redeemedByTelegramId");

-- CreateIndex
CREATE INDEX "entitlements_tenantId_idx" ON "entitlements"("tenantId");

-- CreateIndex
CREATE INDEX "entitlements_ownerTelegramId_idx" ON "entitlements"("ownerTelegramId");

-- CreateIndex
CREATE INDEX "entitlements_kind_idx" ON "entitlements"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "users_telegramUserId_key" ON "users"("telegramUserId");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE INDEX "chats_tenantId_idx" ON "chats"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "chats_tenantId_telegramChatId_key" ON "chats"("tenantId", "telegramChatId");

-- CreateIndex
CREATE INDEX "memberships_tenantId_chatId_idx" ON "memberships"("tenantId", "chatId");

-- CreateIndex
CREATE INDEX "memberships_tenantId_userId_idx" ON "memberships"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "topics_tenantId_idx" ON "topics"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "topics_chatId_telegramTopicId_key" ON "topics"("chatId", "telegramTopicId");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenantId_name_key" ON "roles"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "role_bindings_tenantId_userId_idx" ON "role_bindings"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "role_bindings_tenantId_roleId_idx" ON "role_bindings"("tenantId", "roleId");

-- CreateIndex
CREATE INDEX "native_admin_snapshots_tenantId_chatId_idx" ON "native_admin_snapshots"("tenantId", "chatId");

-- CreateIndex
CREATE INDEX "approvals_tenantId_status_idx" ON "approvals"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_tenantId_key_key" ON "feature_flags"("tenantId", "key");

-- CreateIndex
CREATE INDEX "module_states_tenantId_moduleKey_idx" ON "module_states"("tenantId", "moduleKey");

-- CreateIndex
CREATE UNIQUE INDEX "module_states_tenantId_chatId_moduleKey_key" ON "module_states"("tenantId", "chatId", "moduleKey");

-- CreateIndex
CREATE INDEX "update_inbox_tenantId_botKey_idx" ON "update_inbox"("tenantId", "botKey");

-- CreateIndex
CREATE UNIQUE INDEX "update_inbox_botKey_updateId_key" ON "update_inbox"("botKey", "updateId");

-- CreateIndex
CREATE UNIQUE INDEX "callback_inbox_callbackId_key" ON "callback_inbox"("callbackId");

-- CreateIndex
CREATE INDEX "callback_inbox_tenantId_idx" ON "callback_inbox"("tenantId");

-- CreateIndex
CREATE INDEX "idempotency_keys_tenantId_idx" ON "idempotency_keys"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_namespace_key_key" ON "idempotency_keys"("namespace", "key");

-- CreateIndex
CREATE INDEX "job_outbox_tenantId_state_idx" ON "job_outbox"("tenantId", "state");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "security_alerts_tenantId_severity_idx" ON "security_alerts"("tenantId", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "secrets_refs_tenantId_name_key" ON "secrets_refs"("tenantId", "name");

-- CreateIndex
CREATE INDEX "privacy_requests_tenantId_status_idx" ON "privacy_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "backups_tenantId_status_idx" ON "backups"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "chat_settings_tenantId_chatId_key_key" ON "chat_settings"("tenantId", "chatId", "key");

-- CreateIndex
CREATE INDEX "moderation_cases_tenantId_chatId_idx" ON "moderation_cases"("tenantId", "chatId");

-- CreateIndex
CREATE UNIQUE INDEX "moderation_cases_tenantId_caseNumber_key" ON "moderation_cases"("tenantId", "caseNumber");

-- CreateIndex
CREATE INDEX "sanctions_tenantId_userId_status_idx" ON "sanctions"("tenantId", "userId", "status");

-- CreateIndex
CREATE INDEX "warnings_tenantId_userId_idx" ON "warnings"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "warnings_expiresAt_expiredAt_idx" ON "warnings"("expiresAt", "expiredAt");

-- CreateIndex
CREATE INDEX "reports_tenantId_status_idx" ON "reports"("tenantId", "status");

-- CreateIndex
CREATE INDEX "evidence_tenantId_caseId_idx" ON "evidence"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "appeals_tenantId_caseId_status_idx" ON "appeals"("tenantId", "caseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "spam_profiles_tenantId_chatId_name_key" ON "spam_profiles"("tenantId", "chatId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "antiflood_configs_chatId_key" ON "antiflood_configs"("chatId");

-- CreateIndex
CREATE INDEX "antiflood_configs_tenantId_idx" ON "antiflood_configs"("tenantId");

-- CreateIndex
CREATE INDEX "antiflood_events_tenantId_chatId_createdAt_idx" ON "antiflood_events"("tenantId", "chatId", "createdAt");

-- CreateIndex
CREATE INDEX "antiflood_events_tenantId_telegramUserId_idx" ON "antiflood_events"("tenantId", "telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "antiraid_configs_chatId_key" ON "antiraid_configs"("chatId");

-- CreateIndex
CREATE INDEX "antiraid_configs_tenantId_idx" ON "antiraid_configs"("tenantId");

-- CreateIndex
CREATE INDEX "antiraid_events_tenantId_chatId_createdAt_idx" ON "antiraid_events"("tenantId", "chatId", "createdAt");

-- CreateIndex
CREATE INDEX "notes_tenantId_chatId_idx" ON "notes"("tenantId", "chatId");

-- CreateIndex
CREATE UNIQUE INDEX "notes_chatId_name_key" ON "notes"("chatId", "name");

-- CreateIndex
CREATE INDEX "custom_commands_tenantId_chatId_idx" ON "custom_commands"("tenantId", "chatId");

-- CreateIndex
CREATE UNIQUE INDEX "custom_commands_chatId_name_key" ON "custom_commands"("chatId", "name");

-- CreateIndex
CREATE INDEX "filters_tenantId_chatId_idx" ON "filters"("tenantId", "chatId");

-- CreateIndex
CREATE UNIQUE INDEX "filters_chatId_trigger_key" ON "filters"("chatId", "trigger");

-- CreateIndex
CREATE INDEX "polls_tenantId_chatId_idx" ON "polls"("tenantId", "chatId");

-- CreateIndex
CREATE INDEX "poll_votes_pollId_idx" ON "poll_votes"("pollId");

-- CreateIndex
CREATE UNIQUE INDEX "poll_votes_pollId_telegramUserId_key" ON "poll_votes"("pollId", "telegramUserId");

-- CreateIndex
CREATE INDEX "products_tenantId_chatId_idx" ON "products"("tenantId", "chatId");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenantId_productId_key" ON "products"("tenantId", "productId");

-- CreateIndex
CREATE INDEX "invoices_tenantId_chatId_idx" ON "invoices"("tenantId", "chatId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_chargeId_key" ON "payments"("chargeId");

-- CreateIndex
CREATE INDEX "payments_tenantId_chatId_idx" ON "payments"("tenantId", "chatId");

-- CreateIndex
CREATE INDEX "ai_conversations_tenantId_chatId_idx" ON "ai_conversations"("tenantId", "chatId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_conversations_chatId_telegramUserId_key" ON "ai_conversations"("chatId", "telegramUserId");

-- CreateIndex
CREATE INDEX "ai_messages_conversationId_idx" ON "ai_messages"("conversationId");

-- CreateIndex
CREATE INDEX "ai_usage_tenantId_chatId_createdAt_idx" ON "ai_usage"("tenantId", "chatId", "createdAt");

-- CreateIndex
CREATE INDEX "game_sessions_tenantId_chatId_status_idx" ON "game_sessions"("tenantId", "chatId", "status");

-- CreateIndex
CREATE INDEX "game_scores_chatId_points_idx" ON "game_scores"("chatId", "points");

-- CreateIndex
CREATE UNIQUE INDEX "game_scores_chatId_telegramUserId_key" ON "game_scores"("chatId", "telegramUserId");

-- CreateIndex
CREATE INDEX "file_assets_tenantId_chatId_idx" ON "file_assets"("tenantId", "chatId");

-- CreateIndex
CREATE UNIQUE INDEX "file_assets_tenantId_fileUniqueId_key" ON "file_assets"("tenantId", "fileUniqueId");

-- CreateIndex
CREATE INDEX "webhooks_tenantId_chatId_idx" ON "webhooks"("tenantId", "chatId");

-- CreateIndex
CREATE INDEX "webhook_deliveries_status_createdAt_idx" ON "webhook_deliveries"("status", "createdAt");

-- CreateIndex
CREATE INDEX "webhook_deliveries_tenantId_idx" ON "webhook_deliveries"("tenantId");

-- CreateIndex
CREATE INDEX "feeds_status_idx" ON "feeds"("status");

-- CreateIndex
CREATE INDEX "feeds_tenantId_chatId_idx" ON "feeds"("tenantId", "chatId");

-- CreateIndex
CREATE UNIQUE INDEX "feeds_chatId_url_key" ON "feeds"("chatId", "url");

-- CreateIndex
CREATE INDEX "reminders_status_runAt_idx" ON "reminders"("status", "runAt");

-- CreateIndex
CREATE INDEX "reminders_tenantId_chatId_idx" ON "reminders"("tenantId", "chatId");

-- CreateIndex
CREATE INDEX "tasks_tenantId_chatId_done_idx" ON "tasks"("tenantId", "chatId", "done");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_chatId_number_key" ON "tasks"("chatId", "number");

-- CreateIndex
CREATE INDEX "afk_statuses_tenantId_username_idx" ON "afk_statuses"("tenantId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "afk_statuses_tenantId_telegramUserId_key" ON "afk_statuses"("tenantId", "telegramUserId");

-- CreateIndex
CREATE INDEX "tickets_tenantId_chatId_status_idx" ON "tickets"("tenantId", "chatId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_tenantId_number_key" ON "tickets"("tenantId", "number");

-- CreateIndex
CREATE INDEX "ticket_messages_ticketId_idx" ON "ticket_messages"("ticketId");

-- CreateIndex
CREATE INDEX "scheduled_posts_status_runAt_idx" ON "scheduled_posts"("status", "runAt");

-- CreateIndex
CREATE INDEX "scheduled_posts_tenantId_chatId_idx" ON "scheduled_posts"("tenantId", "chatId");

-- CreateIndex
CREATE INDEX "giveaways_tenantId_chatId_idx" ON "giveaways"("tenantId", "chatId");

-- CreateIndex
CREATE INDEX "giveaway_entries_giveawayId_idx" ON "giveaway_entries"("giveawayId");

-- CreateIndex
CREATE UNIQUE INDEX "giveaway_entries_giveawayId_telegramUserId_key" ON "giveaway_entries"("giveawayId", "telegramUserId");

-- CreateIndex
CREATE INDEX "activity_daily_tenantId_chatId_idx" ON "activity_daily"("tenantId", "chatId");

-- CreateIndex
CREATE UNIQUE INDEX "activity_daily_chatId_day_key" ON "activity_daily"("chatId", "day");

-- CreateIndex
CREATE INDEX "user_activity_chatId_idx" ON "user_activity"("chatId");

-- CreateIndex
CREATE UNIQUE INDEX "user_activity_chatId_telegramUserId_key" ON "user_activity"("chatId", "telegramUserId");

-- CreateIndex
CREATE INDEX "invite_stats_tenantId_chatId_idx" ON "invite_stats"("tenantId", "chatId");

-- CreateIndex
CREATE INDEX "invite_stats_chatId_count_idx" ON "invite_stats"("chatId", "count");

-- CreateIndex
CREATE UNIQUE INDEX "invite_stats_chatId_inviterTelegramId_key" ON "invite_stats"("chatId", "inviterTelegramId");

-- CreateIndex
CREATE INDEX "reputation_profiles_tenantId_chatId_idx" ON "reputation_profiles"("tenantId", "chatId");

-- CreateIndex
CREATE INDEX "reputation_profiles_chatId_points_idx" ON "reputation_profiles"("chatId", "points");

-- CreateIndex
CREATE UNIQUE INDEX "reputation_profiles_chatId_telegramUserId_key" ON "reputation_profiles"("chatId", "telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "welcome_configs_chatId_key" ON "welcome_configs"("chatId");

-- CreateIndex
CREATE INDEX "welcome_configs_tenantId_idx" ON "welcome_configs"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "content_lock_configs_chatId_key" ON "content_lock_configs"("chatId");

-- CreateIndex
CREATE INDEX "content_lock_configs_tenantId_idx" ON "content_lock_configs"("tenantId");

-- CreateIndex
CREATE INDEX "blocklist_entries_tenantId_chatId_idx" ON "blocklist_entries"("tenantId", "chatId");

-- CreateIndex
CREATE UNIQUE INDEX "blocklist_entries_chatId_trigger_key" ON "blocklist_entries"("chatId", "trigger");

-- CreateIndex
CREATE UNIQUE INDEX "blocklist_configs_chatId_key" ON "blocklist_configs"("chatId");

-- CreateIndex
CREATE INDEX "blocklist_configs_tenantId_idx" ON "blocklist_configs"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "warn_policy_configs_chatId_key" ON "warn_policy_configs"("chatId");

-- CreateIndex
CREATE INDEX "warn_policy_configs_tenantId_idx" ON "warn_policy_configs"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "group_hygiene_configs_chatId_key" ON "group_hygiene_configs"("chatId");

-- CreateIndex
CREATE INDEX "group_hygiene_configs_tenantId_idx" ON "group_hygiene_configs"("tenantId");

-- CreateIndex
CREATE INDEX "group_membership_gates_tenantId_idx" ON "group_membership_gates"("tenantId");

-- CreateIndex
CREATE INDEX "group_membership_gates_chatId_idx" ON "group_membership_gates"("chatId");

-- CreateIndex
CREATE INDEX "group_membership_gates_requiredTelegramChatId_idx" ON "group_membership_gates"("requiredTelegramChatId");

-- CreateIndex
CREATE UNIQUE INDEX "group_membership_gates_chatId_requiredTelegramChatId_key" ON "group_membership_gates"("chatId", "requiredTelegramChatId");

-- CreateIndex
CREATE UNIQUE INDEX "verified_users_tenantId_telegramUserId_key" ON "verified_users"("tenantId", "telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "panel_edit_states_tenantId_telegramUserId_key" ON "panel_edit_states"("tenantId", "telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_configs_tenantId_key" ON "feedback_configs"("tenantId");

-- CreateIndex
CREATE INDEX "feedback_users_tenantId_idx" ON "feedback_users"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_users_tenantId_telegramUserId_key" ON "feedback_users"("tenantId", "telegramUserId");

-- CreateIndex
CREATE INDEX "post_reactions_chatId_messageId_idx" ON "post_reactions"("chatId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "post_reactions_chatId_messageId_telegramUserId_key" ON "post_reactions"("chatId", "messageId", "telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "federations_fedId_key" ON "federations"("fedId");

-- CreateIndex
CREATE INDEX "federations_tenantId_idx" ON "federations"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "federation_chats_chatId_key" ON "federation_chats"("chatId");

-- CreateIndex
CREATE INDEX "federation_chats_fedId_idx" ON "federation_chats"("fedId");

-- CreateIndex
CREATE INDEX "federation_bans_fedId_idx" ON "federation_bans"("fedId");

-- CreateIndex
CREATE INDEX "federation_bans_subjectTelegramId_idx" ON "federation_bans"("subjectTelegramId");

-- CreateIndex
CREATE UNIQUE INDEX "federation_bans_fedId_subjectTelegramId_key" ON "federation_bans"("fedId", "subjectTelegramId");

-- CreateIndex
CREATE INDEX "federation_admins_fedId_idx" ON "federation_admins"("fedId");

-- CreateIndex
CREATE UNIQUE INDEX "federation_admins_fedId_telegramUserId_key" ON "federation_admins"("fedId", "telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "owner_network_configs_fedId_key" ON "owner_network_configs"("fedId");

-- CreateIndex
CREATE INDEX "owner_network_configs_tenantId_idx" ON "owner_network_configs"("tenantId");

-- CreateIndex
CREATE INDEX "owner_network_group_roles_tenantId_idx" ON "owner_network_group_roles"("tenantId");

-- CreateIndex
CREATE INDEX "owner_network_group_roles_fedId_idx" ON "owner_network_group_roles"("fedId");

-- CreateIndex
CREATE INDEX "owner_network_group_roles_chatId_idx" ON "owner_network_group_roles"("chatId");

-- CreateIndex
CREATE UNIQUE INDEX "owner_network_group_roles_fedId_chatId_role_key" ON "owner_network_group_roles"("fedId", "chatId", "role");

-- CreateIndex
CREATE INDEX "owner_network_routes_tenantId_idx" ON "owner_network_routes"("tenantId");

-- CreateIndex
CREATE INDEX "owner_network_routes_fedId_idx" ON "owner_network_routes"("fedId");

-- CreateIndex
CREATE INDEX "owner_network_routes_sourceChatId_idx" ON "owner_network_routes"("sourceChatId");

-- CreateIndex
CREATE INDEX "owner_network_routes_targetChatId_idx" ON "owner_network_routes"("targetChatId");

-- CreateIndex
CREATE UNIQUE INDEX "owner_network_routes_fedId_sourceKey_eventKind_key" ON "owner_network_routes"("fedId", "sourceKey", "eventKind");

-- CreateIndex
CREATE INDEX "owner_network_config_snapshots_tenantId_idx" ON "owner_network_config_snapshots"("tenantId");

-- CreateIndex
CREATE INDEX "owner_network_config_snapshots_fedId_idx" ON "owner_network_config_snapshots"("fedId");

-- CreateIndex
CREATE INDEX "owner_network_user_risks_tenantId_idx" ON "owner_network_user_risks"("tenantId");

-- CreateIndex
CREATE INDEX "owner_network_user_risks_fedId_idx" ON "owner_network_user_risks"("fedId");

-- CreateIndex
CREATE UNIQUE INDEX "owner_network_user_risks_fedId_telegramUserId_key" ON "owner_network_user_risks"("fedId", "telegramUserId");

-- CreateIndex
CREATE INDEX "owner_network_user_roles_tenantId_idx" ON "owner_network_user_roles"("tenantId");

-- CreateIndex
CREATE INDEX "owner_network_user_roles_fedId_idx" ON "owner_network_user_roles"("fedId");

-- CreateIndex
CREATE UNIQUE INDEX "owner_network_user_roles_fedId_telegramUserId_key" ON "owner_network_user_roles"("fedId", "telegramUserId");

-- CreateIndex
CREATE INDEX "owner_network_user_notes_tenantId_idx" ON "owner_network_user_notes"("tenantId");

-- CreateIndex
CREATE INDEX "owner_network_user_notes_fedId_subjectTelegramUserId_idx" ON "owner_network_user_notes"("fedId", "subjectTelegramUserId");

-- CreateIndex
CREATE INDEX "owner_network_badges_tenantId_idx" ON "owner_network_badges"("tenantId");

-- CreateIndex
CREATE INDEX "owner_network_badges_fedId_idx" ON "owner_network_badges"("fedId");

-- CreateIndex
CREATE UNIQUE INDEX "owner_network_badges_fedId_telegramUserId_badge_key" ON "owner_network_badges"("fedId", "telegramUserId", "badge");

-- CreateIndex
CREATE INDEX "owner_network_missions_tenantId_idx" ON "owner_network_missions"("tenantId");

-- CreateIndex
CREATE INDEX "owner_network_missions_fedId_idx" ON "owner_network_missions"("fedId");

-- CreateIndex
CREATE UNIQUE INDEX "owner_network_missions_fedId_telegramUserId_kind_key" ON "owner_network_missions"("fedId", "telegramUserId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "owner_network_welcome_buttons_chatId_key" ON "owner_network_welcome_buttons"("chatId");

-- CreateIndex
CREATE INDEX "owner_network_welcome_buttons_tenantId_idx" ON "owner_network_welcome_buttons"("tenantId");

-- CreateIndex
CREATE INDEX "owner_network_automations_tenantId_idx" ON "owner_network_automations"("tenantId");

-- CreateIndex
CREATE INDEX "owner_network_automations_fedId_idx" ON "owner_network_automations"("fedId");

-- CreateIndex
CREATE INDEX "owner_network_automations_chatId_idx" ON "owner_network_automations"("chatId");

-- CreateIndex
CREATE UNIQUE INDEX "owner_network_entitlements_fedId_key" ON "owner_network_entitlements"("fedId");

-- CreateIndex
CREATE INDEX "owner_network_entitlements_tenantId_idx" ON "owner_network_entitlements"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "owner_network_premium_codes_code_key" ON "owner_network_premium_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "captcha_configs_chatId_key" ON "captcha_configs"("chatId");

-- CreateIndex
CREATE INDEX "captcha_configs_tenantId_idx" ON "captcha_configs"("tenantId");

-- CreateIndex
CREATE INDEX "captcha_sessions_tenantId_chatId_status_idx" ON "captcha_sessions"("tenantId", "chatId", "status");

-- CreateIndex
CREATE INDEX "captcha_sessions_tenantId_telegramUserId_status_idx" ON "captcha_sessions"("tenantId", "telegramUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "policy_rules_tenantId_chatId_name_key" ON "policy_rules"("tenantId", "chatId", "name");

-- CreateIndex
CREATE INDEX "chip_wallets_tenantId_idx" ON "chip_wallets"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "chip_wallets_tenantId_telegramUserId_key" ON "chip_wallets"("tenantId", "telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "chip_ledger_chargeId_key" ON "chip_ledger"("chargeId");

-- CreateIndex
CREATE INDEX "chip_ledger_tenantId_telegramUserId_idx" ON "chip_ledger"("tenantId", "telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "chip_ledger_tenantId_telegramUserId_reason_refId_key" ON "chip_ledger"("tenantId", "telegramUserId", "reason", "refId");

-- CreateIndex
CREATE INDEX "casino_duels_tenantId_status_idx" ON "casino_duels"("tenantId", "status");

-- CreateIndex
CREATE INDEX "casino_bets_tenantId_telegramUserId_status_idx" ON "casino_bets"("tenantId", "telegramUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "jackpots_tenantId_key" ON "jackpots"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tournaments_tenantId_period_key" ON "tournaments"("tenantId", "period");

-- CreateIndex
CREATE INDEX "d1_log_configs_tenantId_idx" ON "d1_log_configs"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "d1_log_configs_tenantId_chatId_key" ON "d1_log_configs"("tenantId", "chatId");

-- CreateIndex
CREATE INDEX "d1_events_tenantId_chatId_createdAt_idx" ON "d1_events"("tenantId", "chatId", "createdAt");

-- CreateIndex
CREATE INDEX "d1_events_tenantId_kind_idx" ON "d1_events"("tenantId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "quarantine_configs_chatId_key" ON "quarantine_configs"("chatId");

-- CreateIndex
CREATE INDEX "quarantine_configs_tenantId_idx" ON "quarantine_configs"("tenantId");

-- CreateIndex
CREATE INDEX "quarantine_items_tenantId_chatId_status_idx" ON "quarantine_items"("tenantId", "chatId", "status");

-- CreateIndex
CREATE INDEX "quarantine_items_tenantId_actorTelegramId_idx" ON "quarantine_items"("tenantId", "actorTelegramId");

-- CreateIndex
CREATE INDEX "d1_appeals_tenantId_status_createdAt_idx" ON "d1_appeals"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "d1_appeals_tenantId_appellantTelegramId_idx" ON "d1_appeals"("tenantId", "appellantTelegramId");

-- CreateIndex
CREATE INDEX "automation_rules_tenantId_chatId_active_idx" ON "automation_rules"("tenantId", "chatId", "active");

-- CreateIndex
CREATE INDEX "missions_tenantId_chatId_active_idx" ON "missions"("tenantId", "chatId", "active");

-- CreateIndex
CREATE INDEX "mission_progress_telegramUserId_idx" ON "mission_progress"("telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "mission_progress_missionId_telegramUserId_key" ON "mission_progress"("missionId", "telegramUserId");

-- CreateIndex
CREATE INDEX "user_badges_tenantId_chatId_telegramUserId_idx" ON "user_badges"("tenantId", "chatId", "telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_tenantId_chatId_telegramUserId_badgeKey_key" ON "user_badges"("tenantId", "chatId", "telegramUserId", "badgeKey");

-- AddForeignKey
ALTER TABLE "managed_bots" ADD CONSTRAINT "managed_bots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "entitlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_bindings" ADD CONSTRAINT "role_bindings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_bindings" ADD CONSTRAINT "role_bindings_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_bindings" ADD CONSTRAINT "role_bindings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_states" ADD CONSTRAINT "module_states_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_states" ADD CONSTRAINT "module_states_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_alerts" ADD CONSTRAINT "security_alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_settings" ADD CONSTRAINT "chat_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_settings" ADD CONSTRAINT "chat_settings_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sanctions" ADD CONSTRAINT "sanctions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "giveaway_entries" ADD CONSTRAINT "giveaway_entries_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "giveaways"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_progress" ADD CONSTRAINT "mission_progress_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
