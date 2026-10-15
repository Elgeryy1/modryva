-- Auto-decline a join request whose verification simply ran out.
--
-- Deliberately NOT folded into allowAutomaticDecline: that flag acts on a
-- judgement about a person ("the AI thinks they fail"), where a false positive
-- throws out a real member. This one acts on the absence of any judgement, so
-- it cannot be wrong about anyone — and a decline is not a ban: it lets them
-- request again, which Telegram forbids while a request sits pending. Today
-- those requests are answered "queue" and pile up in the admin queue forever.
ALTER TABLE "guardian_verification_settings"
    ADD COLUMN IF NOT EXISTS "declineOnExpiry" BOOLEAN NOT NULL DEFAULT false;
