CREATE TABLE "platform_user_bans" (
    "id" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "bannedByTelegramId" BIGINT NOT NULL,
    "bannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_user_bans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_user_bans_telegramUserId_key" ON "platform_user_bans"("telegramUserId");
CREATE INDEX "platform_user_bans_revokedAt_idx" ON "platform_user_bans"("revokedAt");
CREATE INDEX "platform_user_bans_expiresAt_idx" ON "platform_user_bans"("expiresAt");
