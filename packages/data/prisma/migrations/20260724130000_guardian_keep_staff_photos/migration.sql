-- Guardian: per-group toggle to keep STAFF report photos in the chat forever.
-- When true, the send path stamps no `staffReportDeleteAfter`, so the retention
-- cleanup job (which only lists sessions whose deadline is <= now) never deletes
-- them. Additive, non-destructive: existing groups default to false (delete as
-- before). protect_content still applies, so kept photos remain non-forwardable.
ALTER TABLE "guardian_verification_settings" ADD COLUMN IF NOT EXISTS "keepStaffPhotos" BOOLEAN NOT NULL DEFAULT false;
