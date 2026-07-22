import {
  InMemoryChatActivityRepository,
  PrismaChatActivityRepository,
  type ChatActivityRepository,
} from "./chat-activity-repository.js";

/**
 * Real vote counter for "duelo de debate" (`/duelo_debate`): counts distinct
 * Telegram users who reacted to a debater's designated message, so the game
 * uses genuine reactions instead of a moderator typing vote totals by hand.
 *
 * Telegram's `message_reaction` update only exposes newly-added emoji per
 * event (see `packages/telegram/src/normalize.ts`'s `emojisAdded`), not a
 * historical reaction count and not removals. So rather than a
 * "getMessageReactionCount"-style read, this repository accumulates votes
 * live: the bot's reaction handler calls `recordVote` on every reaction-add
 * event, and `/duelo_debate` later calls `getVoteCount` to read the tally.
 *
 * Storage rides on the existing `ChatActivityRepository` (kind
 * "debate_vote") instead of a bespoke table, following this repo's "one
 * flexible log backs many small per-message counters" pattern (see
 * `chat-activity-repository.ts` and `chat-setting-repository.ts`) — no new
 * Prisma model needed.
 *
 * KNOWN LIMITATION: because only additions are observable, a voter who
 * removes their reaction is still counted (their vote is never retracted).
 * This is an accepted trade-off, not a bug — flagged for anyone extending
 * this later if Telegram/normalize.ts ever exposes removals.
 */
export interface DebateDuelVoteRepository {
  /**
   * Registers `voterId` as having reacted to `messageId` in `chatId`.
   * Idempotent: a voter who already has a recorded vote for this exact
   * message is a no-op, so repeated reaction-add events from the same user
   * (e.g. switching emoji) never double-count their vote.
   */
  recordVote(
    tenantId: string,
    chatId: string,
    messageId: bigint,
    voterId: bigint,
  ): Promise<void>;

  /** Number of distinct voters recorded for `messageId` in this chat. */
  getVoteCount(
    tenantId: string,
    chatId: string,
    messageId: bigint,
  ): Promise<number>;
}

/** Activity-log `kind` this repository scopes itself to. Internal. */
const DEBATE_VOTE_KIND = "debate_vote";

/** Cap on how many recent votes are scanned per chat when counting. Internal. */
const MAX_SCANNED_VOTES = 1000;

const recordVoteVia = async (
  activity: ChatActivityRepository,
  tenantId: string,
  chatId: string,
  messageId: bigint,
  voterId: bigint,
): Promise<void> => {
  const existing = await activity.findUserEvent(
    tenantId,
    chatId,
    DEBATE_VOTE_KIND,
    voterId,
    messageId,
  );
  if (existing) {
    return;
  }
  await activity.record({
    tenantId,
    chatId,
    kind: DEBATE_VOTE_KIND,
    telegramUserId: voterId,
    messageId,
  });
};

const getVoteCountVia = async (
  activity: ChatActivityRepository,
  tenantId: string,
  chatId: string,
  messageId: bigint,
): Promise<number> => {
  const recent = await activity.listRecent(
    tenantId,
    chatId,
    DEBATE_VOTE_KIND,
    MAX_SCANNED_VOTES,
  );
  const voters = new Set<string>();
  for (const entry of recent) {
    if (entry.messageId === messageId && entry.telegramUserId !== undefined) {
      voters.add(entry.telegramUserId.toString());
    }
  }
  return voters.size;
};

/**
 * Production implementation: delegates to a `ChatActivityRepository`
 * (Prisma-backed by default), so votes persist in the existing
 * `ChatActivityEvent` table under kind "debate_vote". No new table.
 */
export class PrismaDebateDuelVoteRepository implements DebateDuelVoteRepository {
  constructor(
    private readonly activity: ChatActivityRepository = new PrismaChatActivityRepository(),
  ) {}

  async recordVote(
    tenantId: string,
    chatId: string,
    messageId: bigint,
    voterId: bigint,
  ): Promise<void> {
    await recordVoteVia(this.activity, tenantId, chatId, messageId, voterId);
  }

  async getVoteCount(
    tenantId: string,
    chatId: string,
    messageId: bigint,
  ): Promise<number> {
    return getVoteCountVia(this.activity, tenantId, chatId, messageId);
  }
}

/** Store en memoria usado como default del constructor (tests). */
export class InMemoryDebateDuelVoteRepository
  implements DebateDuelVoteRepository
{
  constructor(
    private readonly activity: ChatActivityRepository = new InMemoryChatActivityRepository(),
  ) {}

  async recordVote(
    tenantId: string,
    chatId: string,
    messageId: bigint,
    voterId: bigint,
  ): Promise<void> {
    await recordVoteVia(this.activity, tenantId, chatId, messageId, voterId);
  }

  async getVoteCount(
    tenantId: string,
    chatId: string,
    messageId: bigint,
  ): Promise<number> {
    return getVoteCountVia(this.activity, tenantId, chatId, messageId);
  }
}
