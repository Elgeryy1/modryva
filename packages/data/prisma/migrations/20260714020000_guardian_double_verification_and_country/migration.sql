-- Double verification (requiredPhotos) + nationality/country gate
-- (allowedCountries on settings, countryCode on sessions) were added to
-- schema.prisma AFTER 20260714010000. Without this migration a production DB
-- provisioned from the earlier schema lacks these three columns, so every
-- guardian settings read/write fails with P2022 (column does not exist) and
-- every verification-session insert that carries a resolved country fails too.
--
-- IF NOT EXISTS makes this safe to run against a DB where the columns were
-- already added by hand (the guardian-test stack did exactly that) and safe to
-- re-run, matching how this stack applies schema changes to a live DB.

-- guardian_verification_settings.requiredPhotos: 1 = single photo (default),
-- 2 = double verification (second photo + AI same-person cross-check).
ALTER TABLE "guardian_verification_settings" ADD COLUMN IF NOT EXISTS "requiredPhotos" INTEGER NOT NULL DEFAULT 1;

-- guardian_verification_settings.allowedCountries: ISO 3166-1 alpha-2 codes;
-- empty array = no nationality restriction (the default, so existing rows keep
-- today's behaviour).
ALTER TABLE "guardian_verification_settings" ADD COLUMN IF NOT EXISTS "allowedCountries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- verification_sessions.countryCode: nullable, pinned once from the person's IP
-- (Cloudflare CF-IPCountry) on the Mini App's first request.
ALTER TABLE "verification_sessions" ADD COLUMN IF NOT EXISTS "countryCode" TEXT;
