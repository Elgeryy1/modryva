import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * Live matches between two real people.
 *
 * The server owns the position. Every write here is conditional — on the seat
 * still being free, or on the version the caller read — because both of the
 * things that go wrong in a two-player game are races: two people accepting the
 * same invite, and one person's two taps both landing.
 */

export interface GameMatchRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly chatId: bigint;
  readonly messageId: number | null;
  readonly game: string;
  readonly hostId: bigint;
  readonly hostName: string | null;
  readonly guestId: bigint | null;
  readonly guestName: string | null;
  readonly status: string;
  readonly state: unknown;
  readonly result: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateMatchInput {
  readonly tenantId: string;
  readonly chatId: bigint;
  readonly game: string;
  readonly hostId: bigint;
  readonly hostName: string | null;
  readonly state: unknown;
}

export type JoinResult =
  | { readonly ok: true; readonly match: GameMatchRecord }
  | { readonly ok: false; readonly reason: "taken" | "gone" | "own-match" };

export type MoveCommitResult =
  | { readonly ok: true; readonly match: GameMatchRecord }
  | { readonly ok: false; readonly reason: "raced" };

export interface GameMatchRepository {
  create(input: CreateMatchInput): Promise<GameMatchRecord>;
  find(id: string): Promise<GameMatchRecord | null>;
  /** Remembers the invite message, so it can be edited later. */
  attachMessage(id: string, messageId: number): Promise<void>;
  /**
   * Takes the open seat. Refuses if somebody already took it, if the match is
   * gone, or if the host is trying to play themselves.
   */
  join(
    id: string,
    guestId: bigint,
    guestName: string | null,
  ): Promise<JoinResult>;
  /**
   * Writes a new position, but only if nobody else wrote since `expectedVersion`.
   */
  commitMove(input: {
    readonly id: string;
    readonly expectedVersion: number;
    readonly state: unknown;
    readonly status: string;
    readonly result: string | null;
  }): Promise<MoveCommitResult>;
  /** Open invites for a chat, newest first. */
  listOpen(
    tenantId: string,
    chatId: bigint,
    limit?: number,
  ): Promise<readonly GameMatchRecord[]>;
  /** Host withdrawing their own unaccepted invite. */
  cancel(id: string, hostId: bigint): Promise<boolean>;
}

const toRecord = (row: {
  id: string;
  tenantId: string;
  chatId: bigint;
  messageId: number | null;
  game: string;
  hostId: bigint;
  hostName: string | null;
  guestId: bigint | null;
  guestName: string | null;
  status: string;
  state: unknown;
  result: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): GameMatchRecord => ({ ...row });

export class PrismaGameMatchRepository implements GameMatchRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async create(input: CreateMatchInput): Promise<GameMatchRecord> {
    const row = await this.client.gameMatch.create({
      data: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        game: input.game,
        hostId: input.hostId,
        hostName: input.hostName,
        state: input.state as never,
        status: "open",
      },
    });
    return toRecord(row);
  }

  async find(id: string): Promise<GameMatchRecord | null> {
    const row = await this.client.gameMatch.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async attachMessage(id: string, messageId: number): Promise<void> {
    await this.client.gameMatch.update({
      where: { id },
      data: { messageId },
    });
  }

  async join(
    id: string,
    guestId: bigint,
    guestName: string | null,
  ): Promise<JoinResult> {
    const existing = await this.client.gameMatch.findUnique({ where: { id } });
    if (!existing) {
      return { ok: false, reason: "gone" };
    }
    if (existing.hostId === guestId) {
      return { ok: false, reason: "own-match" };
    }
    // Conditional on the seat STILL being open. Two people tapping "jugar" at
    // the same moment both read `open`; only one of these updates matches.
    const claimed = await this.client.gameMatch.updateMany({
      where: { id, status: "open", guestId: null },
      data: {
        guestId,
        guestName,
        status: "playing",
        version: { increment: 1 },
      },
    });
    if (claimed.count === 0) {
      return { ok: false, reason: "taken" };
    }
    const row = await this.client.gameMatch.findUnique({ where: { id } });
    return row
      ? { ok: true, match: toRecord(row) }
      : { ok: false, reason: "gone" };
  }

  async commitMove(input: {
    id: string;
    expectedVersion: number;
    state: unknown;
    status: string;
    result: string | null;
  }): Promise<MoveCommitResult> {
    const written = await this.client.gameMatch.updateMany({
      where: { id: input.id, version: input.expectedVersion },
      data: {
        state: input.state as never,
        status: input.status,
        result: input.result,
        version: { increment: 1 },
      },
    });
    if (written.count === 0) {
      return { ok: false, reason: "raced" };
    }
    const row = await this.client.gameMatch.findUnique({
      where: { id: input.id },
    });
    return row
      ? { ok: true, match: toRecord(row) }
      : { ok: false, reason: "raced" };
  }

  async listOpen(
    tenantId: string,
    chatId: bigint,
    limit = 20,
  ): Promise<readonly GameMatchRecord[]> {
    const rows = await this.client.gameMatch.findMany({
      where: { tenantId, chatId, status: "open" },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(toRecord);
  }

  async cancel(id: string, hostId: bigint): Promise<boolean> {
    // Only the host, and only while nobody has joined: cancelling a match in
    // progress would let a losing player erase the game.
    const res = await this.client.gameMatch.updateMany({
      where: { id, hostId, status: "open" },
      data: { status: "cancelled", version: { increment: 1 } },
    });
    return res.count > 0;
  }
}

/** Test double — same contract, no database. */
export class InMemoryGameMatchRepository implements GameMatchRepository {
  private readonly rows = new Map<string, GameMatchRecord>();
  private seq = 0;

  async create(input: CreateMatchInput): Promise<GameMatchRecord> {
    const now = new Date();
    const record: GameMatchRecord = {
      id: `gm-${++this.seq}`,
      tenantId: input.tenantId,
      chatId: input.chatId,
      messageId: null,
      game: input.game,
      hostId: input.hostId,
      hostName: input.hostName,
      guestId: null,
      guestName: null,
      status: "open",
      state: input.state,
      result: null,
      version: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(record.id, record);
    return record;
  }

  async find(id: string): Promise<GameMatchRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async attachMessage(id: string, messageId: number): Promise<void> {
    const row = this.rows.get(id);
    if (row) {
      this.rows.set(id, { ...row, messageId });
    }
  }

  async join(
    id: string,
    guestId: bigint,
    guestName: string | null,
  ): Promise<JoinResult> {
    const row = this.rows.get(id);
    if (!row) {
      return { ok: false, reason: "gone" };
    }
    if (row.hostId === guestId) {
      return { ok: false, reason: "own-match" };
    }
    if (row.status !== "open" || row.guestId !== null) {
      return { ok: false, reason: "taken" };
    }
    const next: GameMatchRecord = {
      ...row,
      guestId,
      guestName,
      status: "playing",
      version: row.version + 1,
      updatedAt: new Date(),
    };
    this.rows.set(id, next);
    return { ok: true, match: next };
  }

  async commitMove(input: {
    id: string;
    expectedVersion: number;
    state: unknown;
    status: string;
    result: string | null;
  }): Promise<MoveCommitResult> {
    const row = this.rows.get(input.id);
    if (!row || row.version !== input.expectedVersion) {
      return { ok: false, reason: "raced" };
    }
    const next: GameMatchRecord = {
      ...row,
      state: input.state,
      status: input.status,
      result: input.result,
      version: row.version + 1,
      updatedAt: new Date(),
    };
    this.rows.set(input.id, next);
    return { ok: true, match: next };
  }

  async listOpen(
    tenantId: string,
    chatId: bigint,
    limit = 20,
  ): Promise<readonly GameMatchRecord[]> {
    return [...this.rows.values()]
      .filter(
        (r) =>
          r.tenantId === tenantId && r.chatId === chatId && r.status === "open",
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async cancel(id: string, hostId: bigint): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row || row.hostId !== hostId || row.status !== "open") {
      return false;
    }
    this.rows.set(id, {
      ...row,
      status: "cancelled",
      version: row.version + 1,
    });
    return true;
  }
}
