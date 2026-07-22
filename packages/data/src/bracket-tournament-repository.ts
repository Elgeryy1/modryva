import type { Prisma, PrismaClient } from "@prisma/client";
import {
  advanceBracket,
  BRACKET_BYE,
  type BracketMatch,
  buildBracketRound,
} from "@superbot/module-games";
import { prisma as defaultPrisma } from "./client.js";

/**
 * Single-elimination bracket tournament ("torneo por eliminatorias"): a chat
 * runs one open bracket at a time over a fixed list of entrants (free-text
 * names — team names, memes, usernames, whatever the admin typed), advancing
 * round by round until a single champion remains. The actual pairing/bye
 * logic lives in the pure `modules/games/src/bracket.ts` (`buildBracketRound`,
 * `advanceBracket`); this repository is only responsible for persisting the
 * bracket's state and driving it forward one recorded winner at a time.
 *
 * NOT the same thing as the `Tournament` Prisma model (casino weekly
 * prize-pool) — that one has nothing to do with brackets or elimination.
 */

/** One pending or resolved pairing, mirroring `BracketMatch` from module-games. */
export interface BracketTournamentMatch {
  readonly a: string;
  readonly b: string;
}

export interface BracketTournamentRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly chatId: string;
  readonly status: "open" | "done";
  /** Original full entrant list, kept for display/audit. */
  readonly entrants: readonly string[];
  readonly currentRound: number;
  /** Matches of the current round still awaiting a recorded winner. */
  readonly pendingMatches: readonly BracketTournamentMatch[];
  /** Winners already resolved this round (recorded wins + automatic byes). */
  readonly roundWinners: readonly string[];
  readonly champion: string | null;
}

export type BracketWinnerOutcome =
  | { readonly kind: "not-found" }
  | {
      readonly kind: "already-done";
      readonly tournament: BracketTournamentRecord;
    }
  | {
      readonly kind: "unknown-entrant";
      readonly tournament: BracketTournamentRecord;
    }
  | { readonly kind: "recorded"; readonly tournament: BracketTournamentRecord }
  | {
      readonly kind: "champion";
      readonly tournament: BracketTournamentRecord;
      readonly champion: string;
    };

export interface BracketTournamentRepository {
  /**
   * Starts a new bracket for this chat. Does NOT check for an already-open
   * tournament in the chat — callers that want "one at a time" (the bot
   * command does) should call `getOpenTournament` first and refuse to create
   * a second one, same as every other "one active X per chat" feature.
   */
  createTournament(
    tenantId: string,
    chatId: string,
    entrants: readonly string[],
  ): Promise<BracketTournamentRecord>;
  /** The chat's tournament still in progress, if any. */
  getOpenTournament(
    tenantId: string,
    chatId: string,
  ): Promise<BracketTournamentRecord | null>;
  getTournament(tournamentId: string): Promise<BracketTournamentRecord | null>;
  /**
   * Records `entrant` as the winner of whichever pending match they're still
   * in (case-insensitive match against the stored names). Once every match
   * in the current round has a recorded winner, advances to the next round
   * via `advanceBracket` (auto-resolving any bye along the way); once a
   * single champion remains, marks the tournament done.
   */
  recordWinner(
    tournamentId: string,
    entrant: string,
  ): Promise<BracketWinnerOutcome>;
}

const toJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const readStrings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const readMatches = (value: unknown): BracketTournamentMatch[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: BracketTournamentMatch[] = [];
  for (const item of value) {
    if (
      item !== null &&
      typeof item === "object" &&
      typeof (item as { a?: unknown }).a === "string" &&
      typeof (item as { b?: unknown }).b === "string"
    ) {
      out.push({
        a: (item as { a: string }).a,
        b: (item as { b: string }).b,
      });
    }
  }
  return out;
};

interface RoundState {
  readonly pendingMatches: BracketMatch[];
  readonly roundWinners: string[];
  readonly champion: string | null;
}

/** Splits a round's matches into real pending pairings vs. automatic byes. */
const splitByes = (matches: readonly BracketMatch[]): RoundState => {
  const pendingMatches: BracketMatch[] = [];
  const roundWinners: string[] = [];
  for (const match of matches) {
    if (match.b === BRACKET_BYE) {
      roundWinners.push(match.a);
    } else {
      pendingMatches.push(match);
    }
  }
  return { pendingMatches, roundWinners, champion: null };
};

/** Round 1: pairs the raw entrant list via `buildBracketRound`. */
const firstRound = (entrants: readonly string[]): RoundState => {
  if (entrants.length <= 1) {
    return {
      pendingMatches: [],
      roundWinners: [],
      champion: entrants[0] ?? null,
    };
  }
  return splitByes(buildBracketRound(entrants));
};

/** Round 2+: pairs the previous round's winners via `advanceBracket`. */
const nextRound = (winners: readonly string[]): RoundState => {
  const matches = advanceBracket(winners);
  if (matches.length === 0) {
    // advanceBracket() returns [] both when a single champion remains and
    // when there were 0 winners (shouldn't happen, but stays harmless).
    return {
      pendingMatches: [],
      roundWinners: [],
      champion: winners[0] ?? null,
    };
  }
  return splitByes(matches);
};

type BracketTournamentRow = {
  id: string;
  tenantId: string;
  chatId: string;
  status: string;
  entrants: unknown;
  currentRound: number;
  pendingMatches: unknown;
  roundWinners: unknown;
  champion: string | null;
};

const toRecord = (row: BracketTournamentRow): BracketTournamentRecord => ({
  id: row.id,
  tenantId: row.tenantId,
  chatId: row.chatId,
  status: row.status === "done" ? "done" : "open",
  entrants: readStrings(row.entrants),
  currentRound: row.currentRound,
  pendingMatches: readMatches(row.pendingMatches),
  roundWinners: readStrings(row.roundWinners),
  champion: row.champion,
});

/**
 * Shared decision logic for `recordWinner`, given the current record: finds
 * the pending match `entrant` is in, resolves it, and — if that was the
 * round's last pending match — advances via `nextRound`. Returns either an
 * outcome that needs no further persistence (`not-found` is handled by the
 * caller before this runs) or a `{ patch, outcome }` pair describing what to
 * write back.
 */
const resolveWinner = (
  record: BracketTournamentRecord,
  entrant: string,
):
  | { readonly outcome: BracketWinnerOutcome }
  | {
      readonly patch: {
        readonly status: "open" | "done";
        readonly currentRound: number;
        readonly pendingMatches: readonly BracketMatch[];
        readonly roundWinners: readonly string[];
        readonly champion: string | null;
      };
      readonly outcome: BracketWinnerOutcome;
    } => {
  if (record.status === "done") {
    return { outcome: { kind: "already-done", tournament: record } };
  }

  const needle = entrant.trim().toLowerCase();
  const matchIndex = record.pendingMatches.findIndex(
    (match) =>
      match.a.toLowerCase() === needle || match.b.toLowerCase() === needle,
  );
  const match =
    matchIndex === -1 ? undefined : record.pendingMatches[matchIndex];
  if (!match) {
    return { outcome: { kind: "unknown-entrant", tournament: record } };
  }

  const winnerName = match.a.toLowerCase() === needle ? match.a : match.b;
  const remainingMatches = record.pendingMatches.filter(
    (_, i) => i !== matchIndex,
  );
  const roundWinners = [...record.roundWinners, winnerName];

  if (remainingMatches.length > 0) {
    const patch = {
      status: "open" as const,
      currentRound: record.currentRound,
      pendingMatches: remainingMatches,
      roundWinners,
      champion: null,
    };
    return {
      patch,
      outcome: {
        kind: "recorded",
        tournament: { ...record, ...patch },
      },
    };
  }

  const next = nextRound(roundWinners);
  if (next.champion) {
    const patch = {
      status: "done" as const,
      currentRound: record.currentRound,
      pendingMatches: [],
      roundWinners: [],
      champion: next.champion,
    };
    const tournament = { ...record, ...patch };
    return {
      patch,
      outcome: { kind: "champion", tournament, champion: next.champion },
    };
  }

  const patch = {
    status: "open" as const,
    currentRound: record.currentRound + 1,
    pendingMatches: next.pendingMatches,
    roundWinners: next.roundWinners,
    champion: null,
  };
  return {
    patch,
    outcome: { kind: "recorded", tournament: { ...record, ...patch } },
  };
};

export class PrismaBracketTournamentRepository
  implements BracketTournamentRepository
{
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async createTournament(
    tenantId: string,
    chatId: string,
    entrants: readonly string[],
  ): Promise<BracketTournamentRecord> {
    const initial = firstRound(entrants);
    const row = await this.client.bracketTournament.create({
      data: {
        tenantId,
        chatId,
        status: initial.champion ? "done" : "open",
        entrants: toJson([...entrants]),
        currentRound: 1,
        pendingMatches: toJson([...initial.pendingMatches]),
        roundWinners: toJson([...initial.roundWinners]),
        ...(initial.champion ? { champion: initial.champion } : {}),
      },
    });
    return toRecord(row);
  }

  async getOpenTournament(
    tenantId: string,
    chatId: string,
  ): Promise<BracketTournamentRecord | null> {
    const row = await this.client.bracketTournament.findFirst({
      where: { tenantId, chatId, status: "open" },
      orderBy: { createdAt: "desc" },
    });
    return row ? toRecord(row) : null;
  }

  async getTournament(
    tournamentId: string,
  ): Promise<BracketTournamentRecord | null> {
    const row = await this.client.bracketTournament.findUnique({
      where: { id: tournamentId },
    });
    return row ? toRecord(row) : null;
  }

  async recordWinner(
    tournamentId: string,
    entrant: string,
  ): Promise<BracketWinnerOutcome> {
    const row = await this.client.bracketTournament.findUnique({
      where: { id: tournamentId },
    });
    if (!row) {
      return { kind: "not-found" };
    }

    const result = resolveWinner(toRecord(row), entrant);
    if (!("patch" in result)) {
      return result.outcome;
    }

    await this.client.bracketTournament.update({
      where: { id: tournamentId },
      data: {
        status: result.patch.status,
        currentRound: result.patch.currentRound,
        pendingMatches: toJson([...result.patch.pendingMatches]),
        roundWinners: toJson([...result.patch.roundWinners]),
        champion: result.patch.champion,
      },
    });

    return result.outcome;
  }
}

/** Store en memoria usado como default del constructor (tests). */
export class InMemoryBracketTournamentRepository
  implements BracketTournamentRepository
{
  private readonly rows = new Map<string, BracketTournamentRecord>();
  private sequence = 0;

  async createTournament(
    tenantId: string,
    chatId: string,
    entrants: readonly string[],
  ): Promise<BracketTournamentRecord> {
    this.sequence += 1;
    const initial = firstRound(entrants);
    const record: BracketTournamentRecord = {
      id: `bracket-${this.sequence}`,
      tenantId,
      chatId,
      status: initial.champion ? "done" : "open",
      entrants: [...entrants],
      currentRound: 1,
      pendingMatches: initial.pendingMatches,
      roundWinners: initial.roundWinners,
      champion: initial.champion,
    };
    this.rows.set(record.id, record);
    return record;
  }

  async getOpenTournament(
    tenantId: string,
    chatId: string,
  ): Promise<BracketTournamentRecord | null> {
    let found: BracketTournamentRecord | null = null;
    for (const record of this.rows.values()) {
      if (
        record.tenantId === tenantId &&
        record.chatId === chatId &&
        record.status === "open"
      ) {
        found = record;
      }
    }
    return found;
  }

  async getTournament(
    tournamentId: string,
  ): Promise<BracketTournamentRecord | null> {
    return this.rows.get(tournamentId) ?? null;
  }

  async recordWinner(
    tournamentId: string,
    entrant: string,
  ): Promise<BracketWinnerOutcome> {
    const record = this.rows.get(tournamentId);
    if (!record) {
      return { kind: "not-found" };
    }

    const result = resolveWinner(record, entrant);
    if ("patch" in result) {
      this.rows.set(tournamentId, { ...record, ...result.patch });
    }
    return result.outcome;
  }
}
