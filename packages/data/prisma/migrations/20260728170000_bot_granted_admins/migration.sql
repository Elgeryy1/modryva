-- Administrators appointed BY THE BOT (/admin), and therefore the only ones it
-- is allowed to demote: Telegram forbids a bot from demoting an admin it did
-- not promote itself. Without this ledger the appointed-admin guard could
-- detect abuse but never act on it.
--
-- IF NOT EXISTS throughout: this database has been reconciled against `db push`
-- drift before (see 20260724130000_guardian_keep_staff_photos), so a migration
-- must tolerate the table already being present.
CREATE TABLE IF NOT EXISTS "bot_granted_admins" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramChatId" BIGINT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "customTitle" TEXT,
    "grantedByTelegramId" BIGINT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'active',
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "adoptedExisting" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "bot_granted_admins_pkey" PRIMARY KEY ("id")
);

-- One answer per (tenant, chat, person) to "is this appointment currently
-- ours to revoke?". A second row would make that question ambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS "bot_granted_admins_tenantId_chatId_telegramUserId_key"
    ON "bot_granted_admins" ("tenantId", "chatId", "telegramUserId");

CREATE INDEX IF NOT EXISTS "bot_granted_admins_tenantId_chatId_status_idx"
    ON "bot_granted_admins" ("tenantId", "chatId", "status");

-- Enforcement runs off a chat_member update, which carries the raw Telegram
-- chat id and no internal cuid. This index keeps that lookup off a scan.
CREATE INDEX IF NOT EXISTS "bot_granted_admins_telegramChatId_status_idx"
    ON "bot_granted_admins" ("telegramChatId", "status");
