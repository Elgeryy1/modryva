-- Newcomers who owe the group an introduction.
--
-- Rows live only while the clock runs: deleted on introduction or removal, so
-- the table stays the size of "people currently on the clock" instead of
-- growing with every join the group has ever had.
CREATE TABLE IF NOT EXISTS "introduction_pending" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramChatId" BIGINT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "username" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Stored, not derived from joinedAt: changing the group's deadline later
    -- must not retroactively expel someone who was inside the old window.
    "dueAt" TIMESTAMP(3) NOT NULL,
    "reminders" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "introduction_pending_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "introduction_pending_tenant_chat_user_key"
    ON "introduction_pending" ("tenantId", "chatId", "telegramUserId");

-- The sweep reads by deadline.
CREATE INDEX IF NOT EXISTS "introduction_pending_dueAt_idx"
    ON "introduction_pending" ("dueAt");
