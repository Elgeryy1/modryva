-- maximumAge was added to schema.prisma after the initial guardian migration
-- (the still-photo age-range gate). The initial CREATE TABLE only had
-- minimumAge, so a DB provisioned via `prisma migrate deploy` lacked this
-- column and every getSettings/upsertSettings failed with P2022.
ALTER TABLE "guardian_verification_settings" ADD COLUMN "maximumAge" INTEGER;

-- Session-level retention deadline for the STAFF report message. The report is
-- now the captured face photo (caption = report text); the cleanup worker is
-- driven by this stamp instead of the media delete cursor, so the photo can
-- never be orphaned in the STAFF chat and no-media text reports are covered too.
ALTER TABLE "verification_sessions" ADD COLUMN "staffReportDeleteAfter" TIMESTAMP(3);
CREATE INDEX "verification_sessions_staffReportDeleteAfter_idx" ON "verification_sessions"("staffReportDeleteAfter");
