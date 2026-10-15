CREATE TABLE "ai_memories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "chatId" TEXT,
    "telegramUserId" BIGINT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'user',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_memories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_memories_tenantId_scope_subjectId_key_key" ON "ai_memories"("tenantId", "scope", "subjectId", "key");
CREATE INDEX "ai_memories_tenantId_scope_subjectId_idx" ON "ai_memories"("tenantId", "scope", "subjectId");
CREATE INDEX "ai_memories_tenantId_chatId_idx" ON "ai_memories"("tenantId", "chatId");
CREATE INDEX "ai_memories_tenantId_telegramUserId_idx" ON "ai_memories"("tenantId", "telegramUserId");
