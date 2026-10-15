import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export type OwnerNetworkRiskSignal =
  | "deleted"
  | "report"
  | "quarantine"
  | "link"
  | "sanction";

export const RISK_THRESHOLDS = { low: 5, medium: 12, high: 20 } as const;

export type RiskClassification = "none" | "low" | "medium" | "high";

export const classifyRisk = (score: number): RiskClassification => {
  if (score < RISK_THRESHOLDS.low) {
    return "none";
  }
  if (score < RISK_THRESHOLDS.medium) {
    return "low";
  }
  if (score < RISK_THRESHOLDS.high) {
    return "medium";
  }
  return "high";
};

const SIGNAL_WEIGHTS: Record<OwnerNetworkRiskSignal, number> = {
  deleted: 2,
  report: 3,
  quarantine: 5,
  link: 1,
  sanction: 8,
};

export interface RiskProfileRecord {
  readonly tenantId: string;
  readonly fedId: string;
  readonly telegramUserId: bigint;
  readonly score: number;
  readonly deletedCount: number;
  readonly reportCount: number;
  readonly quarantineCount: number;
  readonly linkCount: number;
  readonly sanctionCount: number;
  readonly chatIds: readonly string[];
  readonly updatedAt: Date;
  readonly createdAt: Date;
}

export interface OwnerNetworkRiskRepository {
  recordSignal(
    tenantId: string,
    fedId: string,
    telegramUserId: bigint,
    chatId: string,
    signal: OwnerNetworkRiskSignal,
  ): Promise<RiskProfileRecord>;
  getProfile(
    fedId: string,
    telegramUserId: bigint,
  ): Promise<RiskProfileRecord | null>;
  listTopRisk(fedId: string, limit?: number): Promise<RiskProfileRecord[]>;
  resetProfile(fedId: string, telegramUserId: bigint): Promise<void>;
}

const COUNT_FIELD_BY_SIGNAL: Record<
  OwnerNetworkRiskSignal,
  | "deletedCount"
  | "reportCount"
  | "quarantineCount"
  | "linkCount"
  | "sanctionCount"
> = {
  deleted: "deletedCount",
  report: "reportCount",
  quarantine: "quarantineCount",
  link: "linkCount",
  sanction: "sanctionCount",
};

const computeScore = (counts: {
  deletedCount: number;
  reportCount: number;
  quarantineCount: number;
  linkCount: number;
  sanctionCount: number;
}): number =>
  counts.deletedCount * SIGNAL_WEIGHTS.deleted +
  counts.reportCount * SIGNAL_WEIGHTS.report +
  counts.quarantineCount * SIGNAL_WEIGHTS.quarantine +
  counts.linkCount * SIGNAL_WEIGHTS.link +
  counts.sanctionCount * SIGNAL_WEIGHTS.sanction;

export class PrismaOwnerNetworkRiskRepository
  implements OwnerNetworkRiskRepository
{
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async recordSignal(
    tenantId: string,
    fedId: string,
    telegramUserId: bigint,
    chatId: string,
    signal: OwnerNetworkRiskSignal,
  ): Promise<RiskProfileRecord> {
    const countField = COUNT_FIELD_BY_SIGNAL[signal];
    const existing = await this.client.ownerNetworkUserRisk.findUnique({
      where: { fedId_telegramUserId: { fedId, telegramUserId } },
    });

    const chatIds = existing?.chatIds.includes(chatId)
      ? existing.chatIds
      : [...(existing?.chatIds ?? []), chatId];

    const counts = {
      deletedCount:
        (existing?.deletedCount ?? 0) + (signal === "deleted" ? 1 : 0),
      reportCount: (existing?.reportCount ?? 0) + (signal === "report" ? 1 : 0),
      quarantineCount:
        (existing?.quarantineCount ?? 0) + (signal === "quarantine" ? 1 : 0),
      linkCount: (existing?.linkCount ?? 0) + (signal === "link" ? 1 : 0),
      sanctionCount:
        (existing?.sanctionCount ?? 0) + (signal === "sanction" ? 1 : 0),
    };
    const score = computeScore(counts);

    const row = await this.client.ownerNetworkUserRisk.upsert({
      where: { fedId_telegramUserId: { fedId, telegramUserId } },
      create: {
        tenantId,
        fedId,
        telegramUserId,
        chatIds,
        score,
        ...counts,
      },
      update: {
        chatIds,
        score,
        [countField]: counts[countField],
      },
    });
    return toRecord(row);
  }

  async getProfile(
    fedId: string,
    telegramUserId: bigint,
  ): Promise<RiskProfileRecord | null> {
    const row = await this.client.ownerNetworkUserRisk.findUnique({
      where: { fedId_telegramUserId: { fedId, telegramUserId } },
    });
    return row ? toRecord(row) : null;
  }

  async listTopRisk(fedId: string, limit = 20): Promise<RiskProfileRecord[]> {
    const rows = await this.client.ownerNetworkUserRisk.findMany({
      where: { fedId },
      orderBy: { score: "desc" },
      take: limit,
    });
    return rows.map(toRecord);
  }

  async resetProfile(fedId: string, telegramUserId: bigint): Promise<void> {
    await this.client.ownerNetworkUserRisk.deleteMany({
      where: { fedId, telegramUserId },
    });
  }
}

export class InMemoryOwnerNetworkRiskRepository
  implements OwnerNetworkRiskRepository
{
  private readonly profiles = new Map<string, RiskProfileRecord>();

  private key(fedId: string, telegramUserId: bigint): string {
    return `${fedId}:${telegramUserId}`;
  }

  async recordSignal(
    tenantId: string,
    fedId: string,
    telegramUserId: bigint,
    chatId: string,
    signal: OwnerNetworkRiskSignal,
  ): Promise<RiskProfileRecord> {
    const key = this.key(fedId, telegramUserId);
    const existing = this.profiles.get(key);
    const countField = COUNT_FIELD_BY_SIGNAL[signal];

    const counts = {
      deletedCount:
        (existing?.deletedCount ?? 0) + (signal === "deleted" ? 1 : 0),
      reportCount: (existing?.reportCount ?? 0) + (signal === "report" ? 1 : 0),
      quarantineCount:
        (existing?.quarantineCount ?? 0) + (signal === "quarantine" ? 1 : 0),
      linkCount: (existing?.linkCount ?? 0) + (signal === "link" ? 1 : 0),
      sanctionCount:
        (existing?.sanctionCount ?? 0) + (signal === "sanction" ? 1 : 0),
    };
    void countField;

    const chatIds = existing?.chatIds.includes(chatId)
      ? existing.chatIds
      : [...(existing?.chatIds ?? []), chatId];

    const next: RiskProfileRecord = {
      tenantId,
      fedId,
      telegramUserId,
      chatIds,
      score: computeScore(counts),
      ...counts,
      updatedAt: new Date(),
      createdAt: existing?.createdAt ?? new Date(),
    };
    this.profiles.set(key, next);
    return next;
  }

  async getProfile(
    fedId: string,
    telegramUserId: bigint,
  ): Promise<RiskProfileRecord | null> {
    return this.profiles.get(this.key(fedId, telegramUserId)) ?? null;
  }

  async listTopRisk(fedId: string, limit = 20): Promise<RiskProfileRecord[]> {
    return [...this.profiles.values()]
      .filter((profile) => profile.fedId === fedId)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async resetProfile(fedId: string, telegramUserId: bigint): Promise<void> {
    this.profiles.delete(this.key(fedId, telegramUserId));
  }
}

const toRecord = (row: {
  tenantId: string;
  fedId: string;
  telegramUserId: bigint;
  score: number;
  deletedCount: number;
  reportCount: number;
  quarantineCount: number;
  linkCount: number;
  sanctionCount: number;
  chatIds: string[];
  updatedAt: Date;
  createdAt: Date;
}): RiskProfileRecord => ({
  tenantId: row.tenantId,
  fedId: row.fedId,
  telegramUserId: row.telegramUserId,
  score: row.score,
  deletedCount: row.deletedCount,
  reportCount: row.reportCount,
  quarantineCount: row.quarantineCount,
  linkCount: row.linkCount,
  sanctionCount: row.sanctionCount,
  chatIds: row.chatIds,
  updatedAt: row.updatedAt,
  createdAt: row.createdAt,
});
