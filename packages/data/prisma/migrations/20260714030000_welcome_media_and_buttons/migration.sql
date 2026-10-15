-- GroupHelp-style welcome: optional photo + inline buttons.
-- Idempotent (IF NOT EXISTS) so it is safe to re-run and safe on a prod DB that
-- may already carry the columns from a manual hotfix. Mirrors the Guardian
-- migration convention in this project.

ALTER TABLE "welcome_configs" ADD COLUMN IF NOT EXISTS "welcomeMediaType" TEXT;
ALTER TABLE "welcome_configs" ADD COLUMN IF NOT EXISTS "welcomeButtons" JSONB;

CREATE TABLE IF NOT EXISTS "welcome_media" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "welcome_media_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "welcome_media_chatId_key" ON "welcome_media"("chatId");
CREATE INDEX IF NOT EXISTS "welcome_media_tenantId_idx" ON "welcome_media"("tenantId");
