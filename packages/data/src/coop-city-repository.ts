import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * Per-member resource contributions to the cooperative city build ("ciudad
 * cooperativa" group-progress game). The pure scoring/leaderboard logic
 * (total, percent, top contributor) lives in @superbot/module-games
 * (coop-city); this repository only records each member's cumulative
 * donation, scoped by tenant + chat + user — one row per contributor with an
 * atomic increment, mirroring the ReputationProfile / GratitudePoint pattern.
 *
 * The shared goal/description for the current build cycle is intentionally
 * NOT stored here: it lives in ChatSetting (key "coop_city_goal"), the
 * existing single-small-value-per-chat store, so this table stays a pure,
 * indexable per-user tally instead of a JSON blob that would need
 * read-modify-write to update one member's total.
 */

/** One member's cumulative contribution to the current build, in a chat. */
export interface CoopCityContributionRecord {
  readonly telegramUserId: bigint;
  readonly resources: number;
}

export interface CoopCityContributionRepository {
  /**
   * Adds `amount` to this member's running total for the current build
   * cycle (creating the row on first contribution). Atomic upsert-increment,
   * safe under concurrent contributions from different members.
   */
  addContribution(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
    amount: number,
  ): Promise<void>;
  /** Every member's cumulative contribution to the current build, in this chat. */
  listContributions(
    tenantId: string,
    chatId: string,
  ): Promise<CoopCityContributionRecord[]>;
  /** Clears every contribution for this chat — starts a fresh build cycle. */
  resetContributions(tenantId: string, chatId: string): Promise<void>;
}

export class PrismaCoopCityContributionRepository
  implements CoopCityContributionRepository
{
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async addContribution(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
    amount: number,
  ): Promise<void> {
    await this.client.coopCityContribution.upsert({
      where: {
        tenantId_chatId_telegramUserId: { tenantId, chatId, telegramUserId },
      },
      create: { tenantId, chatId, telegramUserId, resources: amount },
      update: { resources: { increment: amount } },
    });
  }

  async listContributions(
    tenantId: string,
    chatId: string,
  ): Promise<CoopCityContributionRecord[]> {
    const rows = await this.client.coopCityContribution.findMany({
      where: { tenantId, chatId },
    });
    return rows.map((row) => ({
      telegramUserId: row.telegramUserId,
      resources: row.resources,
    }));
  }

  async resetContributions(tenantId: string, chatId: string): Promise<void> {
    await this.client.coopCityContribution.deleteMany({
      where: { tenantId, chatId },
    });
  }
}

/** Store en memoria usado como default del constructor (tests). */
export class InMemoryCoopCityContributionRepository
  implements CoopCityContributionRepository
{
  private readonly rows = new Map<string, CoopCityContributionRecord>();

  private key(tenantId: string, chatId: string, telegramUserId: bigint): string {
    return `${tenantId}:${chatId}:${telegramUserId}`;
  }

  async addContribution(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
    amount: number,
  ): Promise<void> {
    const key = this.key(tenantId, chatId, telegramUserId);
    const existing = this.rows.get(key)?.resources ?? 0;
    this.rows.set(key, { telegramUserId, resources: existing + amount });
  }

  async listContributions(
    tenantId: string,
    chatId: string,
  ): Promise<CoopCityContributionRecord[]> {
    const prefix = `${tenantId}:${chatId}:`;
    const out: CoopCityContributionRecord[] = [];
    for (const [key, value] of this.rows.entries()) {
      if (key.startsWith(prefix)) {
        out.push(value);
      }
    }
    return out;
  }

  async resetContributions(tenantId: string, chatId: string): Promise<void> {
    const prefix = `${tenantId}:${chatId}:`;
    for (const key of Array.from(this.rows.keys())) {
      if (key.startsWith(prefix)) {
        this.rows.delete(key);
      }
    }
  }
}
