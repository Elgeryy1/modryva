-- Weekly tournament settlement flips status 'open' -> 'settled' BEFORE paying
-- winners (see chip-repository.ts settleTournament). If the process crashed
-- between that flip and the payout loop finishing, the prize was stuck
-- forever: settleEndedTournaments only rescanned status='open' rows, so a
-- half-paid 'settled' tournament was never retried. This column is the
-- "actually paid" marker, mirroring the claimUpdate()/processedAt split.
ALTER TABLE "tournaments" ADD COLUMN "payoutsCompletedAt" TIMESTAMP(3);

-- Backfill: tournaments already settled in production are assumed to have
-- paid out fully (this bug has never been reported), so they don't get
-- rescanned by the widened lazy-settle query below. Even without this
-- backfill, correctness would still hold: ChipLedger's unique constraint
-- (tenantId, telegramUserId, reason, refId) makes a retried payout a no-op.
UPDATE "tournaments" SET "payoutsCompletedAt" = "settledAt" WHERE "status" = 'settled';
