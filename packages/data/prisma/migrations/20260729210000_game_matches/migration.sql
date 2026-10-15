-- Two-player matches (tres en raya first). The server owns the position: the
-- board lives in `state` and clients only ever ask to move.
CREATE TABLE "game_matches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "messageId" INTEGER,
    "game" TEXT NOT NULL,
    "hostId" BIGINT NOT NULL,
    "hostName" TEXT,
    "guestId" BIGINT,
    "guestName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "state" JSONB NOT NULL,
    "result" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_matches_pkey" PRIMARY KEY ("id")
);

-- The lobby lists open matches for one chat.
CREATE INDEX "game_matches_tenantId_chatId_status_idx"
    ON "game_matches"("tenantId", "chatId", "status");

-- The sweeper scans by status and age, across every chat.
CREATE INDEX "game_matches_status_updatedAt_idx"
    ON "game_matches"("status", "updatedAt");
