-- Reconciliacion del drift causado por `prisma db push` contra produccion.
--
-- CONTEXTO (verificado 2026-07-20, ver docs/PLAN-ENDURECIMIENTO-2026-07-20.md Fase 1.5):
--   schema.prisma declaraba 146 modelos, pero las migraciones solo creaban 125 tablas.
--   Las 21 restantes se habian creado a mano con `db push` contra la base de datos viva.
--   Consecuencia: `prisma migrate deploy` sobre una base limpia producia un esquema
--   INCOMPLETO, es decir, la recuperacion ante desastre estaba rota.
--
-- ESTADO DE PARTIDA MEDIDO:
--   - 10 de estas tablas YA EXISTEN en produccion (creadas por db push) y se verifico
--     con `migrate diff --from-url <prod>` que coinciden EXACTAMENTE con el schema:
--     cero ALTER, cero drift estructural.
--   - 12 NO EXISTEN en ningun sitio: son las de los repositorios construidos y nunca
--     registrados en DI (known_admins, eca_rules, speed_rounds, bracket_tournaments...).
--     Ninguna tiene consumidor fuera de tests, por eso nada ha fallado todavia.
--
-- POR QUE `IF NOT EXISTS`:
--   Esta migracion debe poder aplicarse a DOS estados distintos y acabar en el mismo:
--     a) base limpia  -> crea las 22 tablas
--     b) produccion   -> se salta las 10 que ya estan, crea las 12 que faltan
--   Las 2 claves foraneas del final NO llevan guarda porque van sobre tablas que no
--   existen en ninguno de los dos escenarios: siempre se crean en esta misma migracion.
--
-- NO INCLUYE el `DROP TABLE "managed_bots_backup_aioff"` que `migrate diff` propone.
--   Esa tabla tiene 4 filas con tokens cifrados de los bots hijo; es un respaldo manual
--   del apagado del 14-jul. Borrar datos que no gestiona el ORM es una decision del
--   propietario, no un efecto colateral de una migracion. Queda pendiente de decidir:
--   o se declara en schema.prisma, o se borra explicitamente en su propia migracion.
--
-- Generada con:
--   prisma migrate diff --from-migrations <migrations> --to-schema-datamodel <schema> --script
-- y despues endurecida con IF NOT EXISTS. Revisada sentencia a sentencia: 22 CREATE TABLE,
-- 36 CREATE INDEX, 2 ALTER TABLE ADD CONSTRAINT, 0 DROP, 0 sentencias de datos.

-- CreateTable
CREATE TABLE IF NOT EXISTS "staff_notes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "authorTelegramId" BIGINT,
    "authorName" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "economy_wallets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userTelegramId" BIGINT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lastEarnedMs" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "economy_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "incidents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'investigando',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "coop_missions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "goal" INTEGER NOT NULL DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coop_missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "gratitude_points" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userTelegramId" BIGINT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gratitude_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ai_access_codes" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codePrefix" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "note" TEXT,
    "createdByTelegramId" BIGINT NOT NULL,
    "redeemedByChatId" BIGINT,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_access_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ai_chat_access" (
    "id" TEXT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "grantedByCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_chat_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ai_user_access" (
    "id" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_user_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ai_subscriptions" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "targetId" BIGINT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "lastChargeId" TEXT NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "canceled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "chat_activity_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "telegramUserId" BIGINT,
    "username" TEXT,
    "text" TEXT,
    "topic" TEXT,
    "messageId" BIGINT,
    "hasLink" BOOLEAN NOT NULL DEFAULT false,
    "hasMention" BOOLEAN NOT NULL DEFAULT false,
    "isReply" BOOLEAN NOT NULL DEFAULT false,
    "repliedToUserId" BIGINT,
    "tensionScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "admin_decisions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "adminId" BIGINT NOT NULL,
    "action" TEXT NOT NULL,
    "ruleId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "known_admins" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "adminId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "known_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "domain_reputation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domain_reputation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "eca_rules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT,
    "event" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "action" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cooldownMs" INTEGER,
    "expiresAtMs" BIGINT,
    "lastFiredMs" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eca_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "speed_rounds" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "winnerUserId" BIGINT,
    "createdBy" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "speed_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "speed_round_answers" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "userId" BIGINT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speed_round_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "memory_sequence_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "seed" INTEGER NOT NULL,
    "length" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_sequence_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "quiz_difficulty_states" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_difficulty_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "bracket_tournaments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "entrants" JSONB NOT NULL,
    "currentRound" INTEGER NOT NULL DEFAULT 1,
    "pendingMatches" JSONB NOT NULL,
    "roundWinners" JSONB NOT NULL,
    "champion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bracket_tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "battle_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "submittedBy" BIGINT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "battle_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "battle_entry_votes" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "voterId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battle_entry_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "coop_city_contributions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "resources" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "coop_city_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "staff_notes_tenantId_chatId_idx" ON "staff_notes"("tenantId", "chatId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "economy_wallets_tenantId_chatId_userTelegramId_key" ON "economy_wallets"("tenantId", "chatId", "userTelegramId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "incidents_tenantId_chatId_idx" ON "incidents"("tenantId", "chatId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "coop_missions_tenantId_chatId_key" ON "coop_missions"("tenantId", "chatId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "gratitude_points_tenantId_chatId_idx" ON "gratitude_points"("tenantId", "chatId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "gratitude_points_tenantId_chatId_userTelegramId_key" ON "gratitude_points"("tenantId", "chatId", "userTelegramId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ai_access_codes_codeHash_key" ON "ai_access_codes"("codeHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ai_access_codes_createdByTelegramId_idx" ON "ai_access_codes"("createdByTelegramId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ai_chat_access_chatId_key" ON "ai_chat_access"("chatId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ai_user_access_telegramUserId_key" ON "ai_user_access"("telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ai_subscriptions_scope_targetId_key" ON "ai_subscriptions"("scope", "targetId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "chat_activity_events_tenantId_chatId_createdAt_idx" ON "chat_activity_events"("tenantId", "chatId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "chat_activity_events_tenantId_chatId_kind_createdAt_idx" ON "chat_activity_events"("tenantId", "chatId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "chat_activity_events_tenantId_chatId_messageId_idx" ON "chat_activity_events"("tenantId", "chatId", "messageId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admin_decisions_tenantId_chatId_occurredAt_idx" ON "admin_decisions"("tenantId", "chatId", "occurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admin_decisions_tenantId_adminId_idx" ON "admin_decisions"("tenantId", "adminId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "known_admins_tenantId_chatId_idx" ON "known_admins"("tenantId", "chatId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "known_admins_tenantId_chatId_adminId_key" ON "known_admins"("tenantId", "chatId", "adminId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "domain_reputation_tenantId_domain_key" ON "domain_reputation"("tenantId", "domain");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "eca_rules_tenantId_idx" ON "eca_rules"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "eca_rules_chatId_idx" ON "eca_rules"("chatId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "eca_rules_tenantId_event_enabled_idx" ON "eca_rules"("tenantId", "event", "enabled");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "speed_rounds_tenantId_chatId_status_idx" ON "speed_rounds"("tenantId", "chatId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "speed_round_answers_roundId_idx" ON "speed_round_answers"("roundId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "speed_round_answers_roundId_userId_key" ON "speed_round_answers"("roundId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "memory_sequence_sessions_tenantId_idx" ON "memory_sequence_sessions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "memory_sequence_sessions_chatId_telegramUserId_key" ON "memory_sequence_sessions"("chatId", "telegramUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quiz_difficulty_states_tenantId_chatId_idx" ON "quiz_difficulty_states"("tenantId", "chatId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "quiz_difficulty_states_chatId_telegramUserId_key" ON "quiz_difficulty_states"("chatId", "telegramUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bracket_tournaments_tenantId_chatId_status_idx" ON "bracket_tournaments"("tenantId", "chatId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "battle_entries_tenantId_chatId_kind_roundId_idx" ON "battle_entries"("tenantId", "chatId", "kind", "roundId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "battle_entries_roundId_kind_submittedBy_key" ON "battle_entries"("roundId", "kind", "submittedBy");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "battle_entry_votes_entryId_idx" ON "battle_entry_votes"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "battle_entry_votes_roundId_voterId_key" ON "battle_entry_votes"("roundId", "voterId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "coop_city_contributions_tenantId_chatId_idx" ON "coop_city_contributions"("tenantId", "chatId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "coop_city_contributions_tenantId_chatId_telegramUserId_key" ON "coop_city_contributions"("tenantId", "chatId", "telegramUserId");

-- AddForeignKey
ALTER TABLE "speed_round_answers" ADD CONSTRAINT "speed_round_answers_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "speed_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_entry_votes" ADD CONSTRAINT "battle_entry_votes_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "battle_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

