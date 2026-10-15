-- Scope a Mini App visit to the group it was opened for. One bot serves many
-- groups, so scoping by bot alone would surface an unrelated group's members
-- (and their IPs) in this group's roster. Null when the deep link carried no
-- group, e.g. the portable games hub.
ALTER TABLE "miniapp_visits" ADD COLUMN "groupTelegramId" BIGINT;

CREATE INDEX "miniapp_visits_groupTelegramId_idx"
    ON "miniapp_visits"("groupTelegramId");
