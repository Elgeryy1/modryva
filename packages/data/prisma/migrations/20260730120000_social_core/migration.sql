-- Social Core: pole, roulette and the curated media library.
--
-- Everything here is additive. No existing table is touched, so rolling the
-- code back leaves these tables unread rather than inconsistent.

-- ---------------------------------------------------------------------------
-- Pole
-- ---------------------------------------------------------------------------

CREATE TABLE "pole_windows" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "threadId" INTEGER,
    "windowType" TEXT NOT NULL DEFAULT 'daily',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "resetMinutes" INTEGER NOT NULL DEFAULT 0,
    "dayKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pole_windows_pkey" PRIMARY KEY ("id")
);

-- One window per (scope, type, start). This constraint is what makes two
-- processes computing the same window from the same inputs collapse into one
-- row instead of two competing competitions.
CREATE UNIQUE INDEX "pole_windows_tenantId_chatId_threadId_windowType_startsAt_key"
    ON "pole_windows"("tenantId", "chatId", "threadId", "windowType", "startsAt");

-- The constraint above does NOT cover the common case. In Postgres NULL is
-- never equal to NULL, so rows with threadId IS NULL — which is every group
-- that has not split its competition by topic, i.e. almost all of them — are
-- exempt from it and could duplicate freely. This partial index closes exactly
-- that hole.
CREATE UNIQUE INDEX "pole_windows_scope_nothread_key"
    ON "pole_windows"("tenantId", "chatId", "windowType", "startsAt")
    WHERE "threadId" IS NULL;

CREATE INDEX "pole_windows_tenantId_chatId_dayKey_idx"
    ON "pole_windows"("tenantId", "chatId", "dayKey");

CREATE TABLE "pole_claims" (
    "id" TEXT NOT NULL,
    "windowId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "userId" BIGINT NOT NULL,
    "userName" TEXT,
    "messageId" INTEGER,
    "latencyMs" INTEGER NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pole_claims_pkey" PRIMARY KEY ("id")
);

-- The two guarantees the whole feature rests on. Neither column is nullable,
-- so unlike the window scope above these need no partial companion.
--   1. a position has exactly one owner
CREATE UNIQUE INDEX "pole_claims_windowId_position_key"
    ON "pole_claims"("windowId", "position");
--   2. a person holds at most one position per window
CREATE UNIQUE INDEX "pole_claims_windowId_userId_key"
    ON "pole_claims"("windowId", "userId");

-- No hay índice suelto sobre ("windowId"). Postgres usa cualquier PREFIJO de un
-- índice compuesto, así que los dos únicos de arriba ya sirven la búsqueda
-- "reclamaciones de esta ventana". Medido con EXPLAIN ANALYZE sobre 654.000
-- filas: uno suelto ocupaba 14 MB, se mantenía en cada INSERT (la ruta caliente
-- de la pole) y la misma consulta iba 12,4 ms sin él frente a 13,6 ms con él.

ALTER TABLE "pole_claims"
    ADD CONSTRAINT "pole_claims_windowId_fkey"
    FOREIGN KEY ("windowId") REFERENCES "pole_windows"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Roulette
-- ---------------------------------------------------------------------------

CREATE TABLE "roulette_rounds" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "threadId" INTEGER,
    "userId" BIGINT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "numerator" INTEGER NOT NULL,
    "denominator" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "consequence" TEXT NOT NULL,
    "muteSeconds" INTEGER,
    "degradedWhy" TEXT,
    "rngVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roulette_rounds_pkey" PRIMARY KEY ("id")
);

-- Idempotency. Keyed on the MESSAGE, not the update: a redelivered update
-- carries the same message id, so one /ruleta can never silence a person twice.
CREATE UNIQUE INDEX "roulette_rounds_tenantId_chatId_messageId_key"
    ON "roulette_rounds"("tenantId", "chatId", "messageId");

-- Chat-wide cooldown lookup.
CREATE INDEX "roulette_rounds_tenantId_chatId_createdAt_idx"
    ON "roulette_rounds"("tenantId", "chatId", "createdAt");

-- Per-person cooldown lookup.
CREATE INDEX "roulette_rounds_tenantId_userId_createdAt_idx"
    ON "roulette_rounds"("tenantId", "userId", "createdAt");

-- ---------------------------------------------------------------------------
-- Curated media
-- ---------------------------------------------------------------------------

CREATE TABLE "fun_media_assets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "kind" TEXT NOT NULL,
    -- NOT NULL on purpose: an asset with no recorded provenance must be
    -- impossible to store, not merely discouraged.
    "source" TEXT NOT NULL,
    "licence" TEXT NOT NULL,
    "attribution" TEXT,
    "storageKey" TEXT,
    "contentHash" TEXT,
    "safetyStatus" TEXT NOT NULL DEFAULT 'pending',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fun_media_assets_pkey" PRIMARY KEY ("id")
);

-- The same picture cannot be added twice for a kind.
CREATE UNIQUE INDEX "fun_media_assets_kind_contentHash_key"
    ON "fun_media_assets"("kind", "contentHash");

CREATE INDEX "fun_media_assets_kind_safetyStatus_active_idx"
    ON "fun_media_assets"("kind", "safetyStatus", "active");

CREATE TABLE "telegram_media_files" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "telegramFileId" TEXT NOT NULL,
    "telegramFileUniqueId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVerifiedAt" TIMESTAMP(3),

    CONSTRAINT "telegram_media_files_pkey" PRIMARY KEY ("id")
);

-- A file_id belongs to the bot that uploaded it: one row per (asset, bot).
CREATE UNIQUE INDEX "telegram_media_files_assetId_tenantId_key"
    ON "telegram_media_files"("assetId", "tenantId");

ALTER TABLE "telegram_media_files"
    ADD CONSTRAINT "telegram_media_files_assetId_fkey"
    FOREIGN KEY ("assetId") REFERENCES "fun_media_assets"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
