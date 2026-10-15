-- Guardian STAFF reports can now be mirrored to several rooms.
--
-- Two pieces: WHERE to send (a short list on the settings row) and WHERE each
-- copy actually landed (one row per delivered message). The second needs a
-- table rather than more columns because retention has to find and delete every
-- copy, and a verdict has to be stamped on all of them — neither is expressible
-- with the single (staffChatId, staffReportMessageId) pair this replaces.
--
-- IF NOT EXISTS throughout: this database has been reconciled against `db push`
-- drift before, so a migration must tolerate objects already being present.

ALTER TABLE "guardian_verification_settings"
    ADD COLUMN IF NOT EXISTS "extraStaffChats" JSONB;

CREATE TABLE IF NOT EXISTS "verification_staff_reports" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "telegramChatId" BIGINT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "threadId" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_staff_reports_pkey" PRIMARY KEY ("id")
);

-- A resend to the same room must update the row, not add a second one that
-- retention would then try to delete twice.
CREATE UNIQUE INDEX IF NOT EXISTS "verification_staff_reports_session_chat_message_key"
    ON "verification_staff_reports" ("sessionId", "telegramChatId", "messageId");

CREATE INDEX IF NOT EXISTS "verification_staff_reports_sessionId_idx"
    ON "verification_staff_reports" ("sessionId");

-- Cascade so deleting a session cannot strand copies pointing at nothing.
DO $$
BEGIN
    ALTER TABLE "verification_staff_reports"
        ADD CONSTRAINT "verification_staff_reports_sessionId_fkey"
        FOREIGN KEY ("sessionId") REFERENCES "verification_sessions"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
