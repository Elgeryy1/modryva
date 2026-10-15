-- Modryva "passive mode": per-group master switch + three category toggles on
-- group_hygiene_configs. `passiveMode` makes the bot do ONLY Guardian
-- verification + games (so it can coexist with a dedicated moderation bot).
-- The category flags default TRUE so every existing group keeps its current
-- behaviour. Idempotent (ADD COLUMN IF NOT EXISTS) so it is safe to re-run on a
-- host where the columns were already pushed with `prisma db push`.
ALTER TABLE "group_hygiene_configs"
  ADD COLUMN IF NOT EXISTS "passiveMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "group_hygiene_configs"
  ADD COLUMN IF NOT EXISTS "autoModeration" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "group_hygiene_configs"
  ADD COLUMN IF NOT EXISTS "autoCleanup" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "group_hygiene_configs"
  ADD COLUMN IF NOT EXISTS "autoMessages" BOOLEAN NOT NULL DEFAULT true;
