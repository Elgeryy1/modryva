-- Which screen of the Mini App a person got to before giving up. Until now the
-- only signal was "abandoned", with no way to tell a refused camera from a
-- consent screen nobody read.
ALTER TABLE "verification_sessions"
  ADD COLUMN "progressStep" INTEGER NOT NULL DEFAULT 0;
