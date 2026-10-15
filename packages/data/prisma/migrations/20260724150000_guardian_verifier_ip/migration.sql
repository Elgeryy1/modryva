-- Guardian: pin the verifier's client IP (Cloudflare cf-connecting-ip) on the
-- verification session, captured on the first request alongside the country,
-- and shown to STAFF for fraud / multi-account signals. Nullable, additive.
ALTER TABLE "verification_sessions" ADD COLUMN IF NOT EXISTS "verifierIp" TEXT;
