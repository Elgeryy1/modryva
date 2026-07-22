import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * Shared "submit an entry, then vote" storage for the two structurally
 * identical community battle games: playlist-battle (song submissions) and
 * creativity-challenge (meme/idea submissions). Both are votes-desc/id-asc
 * rankers over submitted entries (see `resolvePlaylistBattle` /
 * `resolveCreativityChallenge` in `@superbot/module-games`), so they share
 * one table (discriminated by `kind`) instead of two near-duplicate ones.
 *
 * The generic Poll/PollVote models were considered first but don't fit:
 * Poll.options is a fixed JSON array chosen once at creation time, with no
 * room for a submitter, arbitrary per-entry content, or entries added after
 * the poll opens — exactly what these two games need. PollVote.optionIndex
 * also only makes sense as an index into that fixed array, not a stable id
 * for a dynamically-submitted entry.
 *
 * A round (one open battle/challenge instance in a chat) has no header row
 * of its own here — the "is a round currently open, and what's its id"
 * pointer is tracked by the caller via the existing generic
 * `ChatSettingRepository` (key e.g. `battle:playlist`), the same pattern
 * already used for other one-small-value-per-chat needs. This repository
 * only persists entries and votes for whatever roundId it's given.
 */
export type BattleKind = "playlist" | "creativity";

/** One submitted entry plus its current vote count. */
export interface BattleEntryRecord {
  readonly id: string;
  readonly kind: BattleKind;
  readonly roundId: string;
  readonly submittedBy: bigint;
  readonly content: string;
  readonly votes: number;
  readonly createdAt: Date;
}

export type SubmitBattleEntryResult =
  | { readonly outcome: "submitted"; readonly entry: BattleEntryRecord }
  | { readonly outcome: "duplicate" };

export type VoteBattleEntryResult =
  | { readonly outcome: "voted" }
  | { readonly outcome: "not-found" }
  | { readonly outcome: "self-vote" }
  | { readonly outcome: "duplicate" };

export interface BattleEntriesRepository {
  /**
   * Records a new submission for the given (already-open) round. Returns
   * "duplicate" — no row written — when this user already submitted an
   * entry in this round: one submission per user per round.
   */
  submitEntry(
    tenantId: string,
    chatId: string,
    kind: BattleKind,
    roundId: string,
    submittedBy: bigint,
    content: string,
  ): Promise<SubmitBattleEntryResult>;

  /**
   * Casts one vote for `entryId`, scoped to `roundId`. Validates the entry
   * actually belongs to (tenantId, chatId, kind, roundId) so a stale entryId
   * from a round that already closed is rejected as "not-found" instead of
   * silently voting into a dead round. "self-vote" blocks voting for one's
   * own submission. "duplicate" means this voter already used their one vote
   * for this round (on any entry) — mirrors PollVote's one-vote-per-poll rule.
   */
  voteEntry(
    tenantId: string,
    chatId: string,
    kind: BattleKind,
    roundId: string,
    entryId: string,
    voterId: bigint,
  ): Promise<VoteBattleEntryResult>;

  /** Every entry submitted in this round, each with its current vote count. */
  listRoundEntries(
    tenantId: string,
    chatId: string,
    kind: BattleKind,
    roundId: string,
  ): Promise<BattleEntryRecord[]>;
}

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === "P2002";

export class PrismaBattleEntriesRepository implements BattleEntriesRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async submitEntry(
    tenantId: string,
    chatId: string,
    kind: BattleKind,
    roundId: string,
    submittedBy: bigint,
    content: string,
  ): Promise<SubmitBattleEntryResult> {
    try {
      const row = await this.client.battleEntry.create({
        data: { tenantId, chatId, kind, roundId, submittedBy, content },
      });
      return {
        outcome: "submitted",
        entry: {
          id: row.id,
          kind: row.kind as BattleKind,
          roundId: row.roundId,
          submittedBy: row.submittedBy,
          content: row.content,
          votes: 0,
          createdAt: row.createdAt,
        },
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { outcome: "duplicate" };
      }
      throw error;
    }
  }

  async voteEntry(
    tenantId: string,
    chatId: string,
    kind: BattleKind,
    roundId: string,
    entryId: string,
    voterId: bigint,
  ): Promise<VoteBattleEntryResult> {
    const entry = await this.client.battleEntry.findUnique({
      where: { id: entryId },
    });

    if (
      !entry ||
      entry.tenantId !== tenantId ||
      entry.chatId !== chatId ||
      entry.kind !== kind ||
      entry.roundId !== roundId
    ) {
      return { outcome: "not-found" };
    }

    if (entry.submittedBy === voterId) {
      return { outcome: "self-vote" };
    }

    try {
      await this.client.battleEntryVote.create({
        data: { entryId, roundId, voterId },
      });
      return { outcome: "voted" };
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { outcome: "duplicate" };
      }
      throw error;
    }
  }

  async listRoundEntries(
    tenantId: string,
    chatId: string,
    kind: BattleKind,
    roundId: string,
  ): Promise<BattleEntryRecord[]> {
    const rows = await this.client.battleEntry.findMany({
      where: { tenantId, chatId, kind, roundId },
      include: { _count: { select: { votes: true } } },
      orderBy: { createdAt: "asc" },
    });

    return rows.map(
      (row: {
        id: string;
        kind: string;
        roundId: string;
        submittedBy: bigint;
        content: string;
        createdAt: Date;
        _count: { votes: number };
      }) => ({
        id: row.id,
        kind: row.kind as BattleKind,
        roundId: row.roundId,
        submittedBy: row.submittedBy,
        content: row.content,
        votes: row._count.votes,
        createdAt: row.createdAt,
      }),
    );
  }
}

/** Store en memoria usado como default del constructor (tests). */
export class InMemoryBattleEntriesRepository implements BattleEntriesRepository {
  private readonly entries = new Map<
    string,
    {
      id: string;
      tenantId: string;
      chatId: string;
      kind: BattleKind;
      roundId: string;
      submittedBy: bigint;
      content: string;
      createdAt: Date;
    }
  >();
  private readonly votes = new Map<
    string,
    { entryId: string; roundId: string; voterId: bigint }
  >();
  private sequence = 0;

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}_${this.sequence}`;
  }

  private toRecord(entry: {
    id: string;
    kind: BattleKind;
    roundId: string;
    submittedBy: bigint;
    content: string;
    createdAt: Date;
  }): BattleEntryRecord {
    const votes = [...this.votes.values()].filter(
      (vote) => vote.entryId === entry.id,
    ).length;
    return {
      id: entry.id,
      kind: entry.kind,
      roundId: entry.roundId,
      submittedBy: entry.submittedBy,
      content: entry.content,
      votes,
      createdAt: entry.createdAt,
    };
  }

  async submitEntry(
    tenantId: string,
    chatId: string,
    kind: BattleKind,
    roundId: string,
    submittedBy: bigint,
    content: string,
  ): Promise<SubmitBattleEntryResult> {
    const alreadySubmitted = [...this.entries.values()].some(
      (entry) =>
        entry.roundId === roundId &&
        entry.kind === kind &&
        entry.submittedBy === submittedBy,
    );
    if (alreadySubmitted) {
      return { outcome: "duplicate" };
    }

    const entry = {
      id: this.nextId("entry"),
      tenantId,
      chatId,
      kind,
      roundId,
      submittedBy,
      content,
      createdAt: new Date(),
    };
    this.entries.set(entry.id, entry);
    return { outcome: "submitted", entry: this.toRecord(entry) };
  }

  async voteEntry(
    tenantId: string,
    chatId: string,
    kind: BattleKind,
    roundId: string,
    entryId: string,
    voterId: bigint,
  ): Promise<VoteBattleEntryResult> {
    const entry = this.entries.get(entryId);
    if (
      !entry ||
      entry.tenantId !== tenantId ||
      entry.chatId !== chatId ||
      entry.kind !== kind ||
      entry.roundId !== roundId
    ) {
      return { outcome: "not-found" };
    }

    if (entry.submittedBy === voterId) {
      return { outcome: "self-vote" };
    }

    const alreadyVoted = [...this.votes.values()].some(
      (vote) => vote.roundId === roundId && vote.voterId === voterId,
    );
    if (alreadyVoted) {
      return { outcome: "duplicate" };
    }

    const voteId = this.nextId("vote");
    this.votes.set(voteId, { entryId, roundId, voterId });
    return { outcome: "voted" };
  }

  async listRoundEntries(
    tenantId: string,
    chatId: string,
    kind: BattleKind,
    roundId: string,
  ): Promise<BattleEntryRecord[]> {
    return [...this.entries.values()]
      .filter(
        (entry) =>
          entry.tenantId === tenantId &&
          entry.chatId === chatId &&
          entry.kind === kind &&
          entry.roundId === roundId,
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((entry) => this.toRecord(entry));
  }
}
