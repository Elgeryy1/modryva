import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * Moneda de gratitud (ideas #269/#521): puntos que un miembro acumula cuando
 * otros le agradecen su ayuda. La logica pura (sumar, rankear) vive en
 * @superbot/module-games (gratitude); aqui solo esta la persistencia por
 * tenant + chat + usuario. Nunca representa dinero real.
 */

/** Puntos de gratitud de un usuario. */
export interface GratitudeEntry {
  readonly userTelegramId: bigint;
  readonly points: number;
}

export interface GratitudeRepository {
  getPoints(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
  ): Promise<number>;
  setPoints(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    points: number,
  ): Promise<void>;
  top(
    tenantId: string,
    chatId: string,
    limit: number,
  ): Promise<GratitudeEntry[]>;
}

export class PrismaGratitudeRepository implements GratitudeRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async getPoints(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
  ): Promise<number> {
    const row = await this.client.gratitudePoint.findUnique({
      where: {
        tenantId_chatId_userTelegramId: { tenantId, chatId, userTelegramId },
      },
    });
    return row?.points ?? 0;
  }

  async setPoints(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    points: number,
  ): Promise<void> {
    await this.client.gratitudePoint.upsert({
      where: {
        tenantId_chatId_userTelegramId: { tenantId, chatId, userTelegramId },
      },
      create: { tenantId, chatId, userTelegramId, points },
      update: { points },
    });
  }

  async top(
    tenantId: string,
    chatId: string,
    limit: number,
  ): Promise<GratitudeEntry[]> {
    const rows = await this.client.gratitudePoint.findMany({
      where: { tenantId, chatId },
      orderBy: { points: "desc" },
      take: limit,
    });
    return rows.map((row) => ({
      userTelegramId: row.userTelegramId,
      points: row.points,
    }));
  }
}

/** Store en memoria usado como default del constructor (tests). */
export class InMemoryGratitudeRepository implements GratitudeRepository {
  private points = new Map<string, number>();

  private key(tenantId: string, chatId: string, user: bigint): string {
    return `${tenantId}:${chatId}:${user.toString()}`;
  }

  async getPoints(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
  ): Promise<number> {
    return this.points.get(this.key(tenantId, chatId, userTelegramId)) ?? 0;
  }

  async setPoints(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    points: number,
  ): Promise<void> {
    this.points.set(this.key(tenantId, chatId, userTelegramId), points);
  }

  async top(
    tenantId: string,
    chatId: string,
    limit: number,
  ): Promise<GratitudeEntry[]> {
    const prefix = `${tenantId}:${chatId}:`;
    const entries: GratitudeEntry[] = [];
    for (const [key, points] of this.points) {
      if (key.startsWith(prefix)) {
        entries.push({
          userTelegramId: BigInt(key.slice(prefix.length)),
          points,
        });
      }
    }
    entries.sort((a, b) => b.points - a.points);
    return entries.slice(0, limit);
  }
}
