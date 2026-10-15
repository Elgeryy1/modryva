-- Feeds that fail keep being polled every minute forever, and the poll loop
-- discarded the reason, so a URL that had never once succeeded looked exactly
-- like a healthy feed with nothing new. Count consecutive failures so a broken
-- feed can be paused, and keep the last reason where a human can read it.
ALTER TABLE "feeds"
  ADD COLUMN IF NOT EXISTS "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastError" TEXT;
