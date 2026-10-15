-- Privacy-minimized membership/activity data for the read-only Mini App
-- insights. No message body, media, phone number, or profile name is stored.
CREATE TABLE "member_activity_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "username" TEXT,
    "membershipObservedAt" TIMESTAMP(3) NOT NULL,
    "historyScannedAt" TIMESTAMP(3),
    "historicalMessages" INTEGER NOT NULL DEFAULT 0,
    "historicalLastMessageAt" TIMESTAMP(3),
    "liveMessages" INTEGER NOT NULL DEFAULT 0,
    "liveLastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_activity_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "member_activity_profiles_tenantId_chatId_telegramUserId_key"
ON "member_activity_profiles"("tenantId", "chatId", "telegramUserId");

CREATE INDEX "member_activity_profiles_tenantId_chatId_idx"
ON "member_activity_profiles"("tenantId", "chatId");

CREATE INDEX "member_activity_profiles_tenantId_chatId_historicalLastMessageAt_idx"
ON "member_activity_profiles"("tenantId", "chatId", "historicalLastMessageAt");
