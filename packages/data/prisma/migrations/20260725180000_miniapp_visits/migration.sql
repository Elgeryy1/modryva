-- Mini App opens attributable to a person outside the verification flow, so the
-- multi-account check also covers members who play but never (re)verified.
-- One row per (bot, person, IP); repeats bump `visits` rather than adding rows.
CREATE TABLE "miniapp_visits" (
    "id" TEXT NOT NULL,
    "botUsername" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "ip" TEXT NOT NULL,
    "countryCode" TEXT,
    "surface" TEXT NOT NULL,
    "visits" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "miniapp_visits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "miniapp_visits_botUsername_telegramUserId_ip_key"
    ON "miniapp_visits"("botUsername", "telegramUserId", "ip");

CREATE INDEX "miniapp_visits_botUsername_ip_idx"
    ON "miniapp_visits"("botUsername", "ip");

-- Not needed today (retention is deliberately unlimited), but keeps a future
-- purge cheap instead of requiring a full scan.
CREATE INDEX "miniapp_visits_lastSeenAt_idx" ON "miniapp_visits"("lastSeenAt");
