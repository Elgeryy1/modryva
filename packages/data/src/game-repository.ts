import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

const toJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

export interface GameSessionRecord {
  readonly id: string;
  readonly kind: string;
  readonly status: string;
  readonly correctIndex: number;
  readonly chatId: string;
  readonly createdAt: Date;
  readonly payload: unknown;
}

export interface GameScoreState {
  readonly telegramUserId: bigint;
  readonly points: number;
  /** Resolved display name (topScores only); null when the user is unknown. */
  readonly name?: string | null;
}

export interface GameRepository {
  createSession(
    tenantId: string,
    chatId: string,
    kind: string,
    payload: unknown,
    correctIndex: number,
  ): Promise<GameSessionRecord>;
  getSession(sessionId: string): Promise<GameSessionRecord | null>;
  closeWithWinner(
    sessionId: string,
    winnerTelegramId: bigint,
  ): Promise<boolean>;
  addScore(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
    delta: number,
  ): Promise<GameScoreState>;
  topScores(chatId: string, limit: number): Promise<GameScoreState[]>;
  /** A user's total points across every scope (personal/group/portable) in a tenant. */
  sumUserPoints(tenantId: string, telegramUserId: bigint): Promise<number>;
  /** Global leaderboard: total points per user across all scopes, top `limit`. */
  topPlayers(tenantId: string, limit: number): Promise<GameScoreState[]>;
}

export class PrismaGameRepository implements GameRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async createSession(
    tenantId: string,
    chatId: string,
    kind: string,
    payload: unknown,
    correctIndex: number,
  ): Promise<GameSessionRecord> {
    const session = await this.client.gameSession.create({
      data: {
        tenantId,
        chatId,
        kind,
        correctIndex,
        payload: toJson(payload),
      },
    });

    return {
      id: session.id,
      kind: session.kind,
      status: session.status,
      correctIndex: session.correctIndex,
      chatId: session.chatId,
      createdAt: session.createdAt,
      payload: session.payload,
    };
  }

  async getSession(sessionId: string): Promise<GameSessionRecord | null> {
    const session = await this.client.gameSession.findUnique({
      where: { id: sessionId },
    });

    return session
      ? {
          id: session.id,
          kind: session.kind,
          status: session.status,
          correctIndex: session.correctIndex,
          chatId: session.chatId,
          createdAt: session.createdAt,
          payload: session.payload,
        }
      : null;
  }

  /**
   * Atomically closes an open session and records the winner. Returns false when
   * the session was already closed (so only the first correct answer wins).
   */
  async closeWithWinner(
    sessionId: string,
    winnerTelegramId: bigint,
  ): Promise<boolean> {
    const result = await this.client.gameSession.updateMany({
      where: { id: sessionId, status: "open" },
      data: { status: "closed", winnerTelegramId },
    });

    return result.count > 0;
  }

  async addScore(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
    delta: number,
  ): Promise<GameScoreState> {
    const score = await this.client.gameScore.upsert({
      where: { chatId_telegramUserId: { chatId, telegramUserId } },
      create: { tenantId, chatId, telegramUserId, points: delta },
      update: { points: { increment: delta } },
    });

    return { telegramUserId: score.telegramUserId, points: score.points };
  }

  async topScores(chatId: string, limit: number): Promise<GameScoreState[]> {
    const scores = await this.client.gameScore.findMany({
      where: { chatId },
      orderBy: { points: "desc" },
      take: limit,
    });

    // Resolve human names in one batch: GameScore has no FK to AppUser, so we
    // look the players up by their (globally unique) telegram id and fall back
    // to the raw id when the user has never been seen.
    const ids = scores.map((score) => score.telegramUserId);
    const users =
      ids.length > 0
        ? await this.client.appUser.findMany({
            where: { telegramUserId: { in: ids } },
            select: { telegramUserId: true, displayName: true, username: true },
          })
        : [];
    const nameById = new Map<string, string>();
    for (const user of users) {
      const name =
        user.displayName ?? (user.username ? `@${user.username}` : null);
      if (name) {
        nameById.set(user.telegramUserId.toString(), name);
      }
    }

    return scores.map((score) => ({
      telegramUserId: score.telegramUserId,
      points: score.points,
      name: nameById.get(score.telegramUserId.toString()) ?? null,
    }));
  }

  async sumUserPoints(
    tenantId: string,
    telegramUserId: bigint,
  ): Promise<number> {
    const agg = await this.client.gameScore.aggregate({
      where: { tenantId, telegramUserId },
      _sum: { points: true },
    });
    return agg._sum.points ?? 0;
  }

  async topPlayers(tenantId: string, limit: number): Promise<GameScoreState[]> {
    // One row per user = their total points across every scope, highest first.
    const grouped = await this.client.gameScore.groupBy({
      by: ["telegramUserId"],
      where: { tenantId },
      _sum: { points: true },
      orderBy: { _sum: { points: "desc" } },
      take: limit,
    });
    const ids = grouped.map((row) => row.telegramUserId);
    const users =
      ids.length > 0
        ? await this.client.appUser.findMany({
            where: { telegramUserId: { in: ids } },
            select: { telegramUserId: true, displayName: true, username: true },
          })
        : [];
    const nameById = new Map<string, string>();
    for (const user of users) {
      const name =
        user.displayName ?? (user.username ? `@${user.username}` : null);
      if (name) {
        nameById.set(user.telegramUserId.toString(), name);
      }
    }
    return grouped.map((row) => ({
      telegramUserId: row.telegramUserId,
      points: row._sum.points ?? 0,
      name: nameById.get(row.telegramUserId.toString()) ?? null,
    }));
  }
}
