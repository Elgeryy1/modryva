import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * Mini App opens attributable to a person OUTSIDE Guardian's verification flow
 * (today: the games app). Feeds the same multi-account check, which otherwise
 * only ever sees the minority of members who went through a join verification.
 *
 * Deliberately NOT stored in verification_sessions: that table means "someone
 * verified", and mixing app opens into it would both misreport who verified and
 * corrupt the roster's counts.
 */

export interface RecordMiniappVisitInput {
  readonly botUsername: string;
  readonly telegramUserId: bigint;
  readonly username?: string | null;
  readonly firstName?: string | null;
  readonly lastName?: string | null;
  readonly ip: string;
  readonly countryCode?: string | null;
  /** Raw Telegram id of the group this was opened for, when the deep link
   * carried one. Null for the portable games hub. */
  readonly groupTelegramId?: bigint | null;
  /** Which Mini App, e.g. "games". */
  readonly surface: string;
}

export interface MiniappVisitRecord {
  readonly telegramUserId: bigint;
  readonly username: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly ip: string;
  readonly countryCode: string | null;
  readonly groupTelegramId: bigint | null;
  readonly surface: string;
  readonly visits: number;
  readonly firstSeenAt: Date;
  readonly lastSeenAt: Date;
}

export interface MiniappVisitRepository {
  record(input: RecordMiniappVisitInput): Promise<void>;
  /**
   * Visits a given group's admins may see: the ones opened FOR that group, plus
   * group-less ones (the portable hub) by people the caller already knows
   * belong there. One bot serves many groups, so listing by bot alone would put
   * an unrelated community's members in front of these admins.
   */
  listForGroup(
    botUsername: string,
    groupTelegramId: bigint,
    knownUserIds: readonly bigint[],
    limit?: number,
  ): Promise<MiniappVisitRecord[]>;
  /**
   * Same rule, for several groups at once — the cross-group roster an owner
   * sees. Still NOT "everything this bot ever saw": a group-less visit only
   * comes along when the caller already knows that person from one of the
   * groups it passed in, so widening the group list can never reach a
   * community the caller does not administer.
   */
  listForGroups(
    botUsername: string,
    groupTelegramIds: readonly bigint[],
    knownUserIds: readonly bigint[],
    limit?: number,
  ): Promise<MiniappVisitRecord[]>;
  /**
   * EVERY visit this bot ever recorded, group or no group — including opens
   * from a private chat that name no community at all, which the group-scoped
   * queries can only surface for someone already known in one of them.
   *
   * Deliberately unscoped, so it is ONLY for the platform owner: for anyone
   * else it would be the cross-tenant leak the other two methods exist to
   * prevent. Callers must gate it on ownership, never on group admin.
   */
  listForBot(
    botUsername: string,
    limit?: number,
  ): Promise<MiniappVisitRecord[]>;
}

export class PrismaMiniappVisitRepository implements MiniappVisitRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  /**
   * Upserts on (bot, person, IP): the same person reopening the app from the
   * same connection bumps a counter instead of adding a row, so the table
   * tracks distinct connections rather than growing with every launch.
   * The name fields are refreshed on every visit — people rename themselves,
   * and a stale @ in the roster is worse than none.
   */
  async record(input: RecordMiniappVisitInput): Promise<void> {
    await this.client.miniappVisit.upsert({
      where: {
        botUsername_telegramUserId_ip: {
          botUsername: input.botUsername,
          telegramUserId: input.telegramUserId,
          ip: input.ip,
        },
      },
      create: {
        botUsername: input.botUsername,
        telegramUserId: input.telegramUserId,
        username: input.username ?? null,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        ip: input.ip,
        countryCode: input.countryCode ?? null,
        groupTelegramId: input.groupTelegramId ?? null,
        surface: input.surface,
      },
      update: {
        visits: { increment: 1 },
        lastSeenAt: new Date(),
        username: input.username ?? null,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        ...(input.countryCode ? { countryCode: input.countryCode } : {}),
        // A later open that DOES name a group upgrades a group-less row; never
        // the other way round, so scoping can only ever get more precise.
        ...(input.groupTelegramId
          ? { groupTelegramId: input.groupTelegramId }
          : {}),
      },
    });
  }

  async listForGroup(
    botUsername: string,
    groupTelegramId: bigint,
    knownUserIds: readonly bigint[],
    limit = 2000,
  ): Promise<MiniappVisitRecord[]> {
    return this.listForGroups(
      botUsername,
      [groupTelegramId],
      knownUserIds,
      limit,
    );
  }

  async listForBot(
    botUsername: string,
    limit = 5000,
  ): Promise<MiniappVisitRecord[]> {
    const rows = await this.client.miniappVisit.findMany({
      where: { botUsername },
      orderBy: { lastSeenAt: "desc" },
      take: limit,
    });
    return rows.map(toVisitRecord);
  }

  async listForGroups(
    botUsername: string,
    groupTelegramIds: readonly bigint[],
    knownUserIds: readonly bigint[],
    limit = 2000,
  ): Promise<MiniappVisitRecord[]> {
    if (groupTelegramIds.length === 0) {
      return [];
    }
    const rows = await this.client.miniappVisit.findMany({
      where: {
        botUsername,
        OR: [
          { groupTelegramId: { in: [...groupTelegramIds] } },
          ...(knownUserIds.length > 0
            ? [
                {
                  groupTelegramId: null,
                  telegramUserId: { in: [...knownUserIds] },
                },
              ]
            : []),
        ],
      },
      orderBy: { lastSeenAt: "desc" },
      take: limit,
    });
    return rows.map(toVisitRecord);
  }
}

/** Prisma row -> port record. Shared so the two queries can never drift into
 * returning differently-shaped rows. */
const toVisitRecord = (row: {
  telegramUserId: bigint;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  ip: string;
  countryCode: string | null;
  groupTelegramId: bigint | null;
  surface: string;
  visits: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}): MiniappVisitRecord => ({
  telegramUserId: row.telegramUserId,
  username: row.username,
  firstName: row.firstName,
  lastName: row.lastName,
  ip: row.ip,
  countryCode: row.countryCode,
  groupTelegramId: row.groupTelegramId,
  surface: row.surface,
  visits: row.visits,
  firstSeenAt: row.firstSeenAt,
  lastSeenAt: row.lastSeenAt,
});

/** Test double — same contract, no database. */
export class InMemoryMiniappVisitRepository implements MiniappVisitRepository {
  private readonly rows = new Map<string, MiniappVisitRecord>();

  async record(input: RecordMiniappVisitInput): Promise<void> {
    const key = `${input.botUsername}:${input.telegramUserId}:${input.ip}`;
    const existing = this.rows.get(key);
    const now = new Date();
    this.rows.set(key, {
      telegramUserId: input.telegramUserId,
      username: input.username ?? null,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      ip: input.ip,
      countryCode: input.countryCode ?? existing?.countryCode ?? null,
      groupTelegramId:
        input.groupTelegramId ?? existing?.groupTelegramId ?? null,
      surface: input.surface,
      visits: (existing?.visits ?? 0) + 1,
      firstSeenAt: existing?.firstSeenAt ?? now,
      lastSeenAt: now,
    });
  }

  async listForGroup(
    botUsername: string,
    groupTelegramId: bigint,
    knownUserIds: readonly bigint[],
    limit = 2000,
  ): Promise<MiniappVisitRecord[]> {
    return this.listForGroups(
      botUsername,
      [groupTelegramId],
      knownUserIds,
      limit,
    );
  }

  async listForBot(
    _botUsername: string,
    limit = 5000,
  ): Promise<MiniappVisitRecord[]> {
    return [...this.rows.values()]
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
      .slice(0, limit);
  }

  async listForGroups(
    _botUsername: string,
    groupTelegramIds: readonly bigint[],
    knownUserIds: readonly bigint[],
    limit = 2000,
  ): Promise<MiniappVisitRecord[]> {
    // Matches the Prisma path's early return. Without it a caller who
    // administers no groups would still be handed every group-less visit for
    // the ids they passed — the fake would be more permissive than production,
    // which is the one direction a test double must never be.
    if (groupTelegramIds.length === 0) {
      return [];
    }
    const known = new Set(knownUserIds.map((id) => id.toString()));
    const wanted = new Set(groupTelegramIds.map((id) => id.toString()));
    return [...this.rows.values()]
      .filter(
        (row) =>
          (row.groupTelegramId !== null &&
            wanted.has(row.groupTelegramId.toString())) ||
          (row.groupTelegramId === null &&
            known.has(row.telegramUserId.toString())),
      )
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
      .slice(0, limit);
  }
}
