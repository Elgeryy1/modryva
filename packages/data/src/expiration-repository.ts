import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export interface DueSanction {
  readonly id: string;
  readonly tenantId: string;
  readonly kind: string;
  readonly telegramUserId: bigint | undefined;
  readonly telegramChatId: bigint | undefined;
}

export interface DueWarning {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
}

const readBigInt = (value: unknown): bigint | undefined => {
  if (typeof value === "string" && /^-?\d+$/u.test(value)) {
    return BigInt(value);
  }
  return undefined;
};

export interface ExpirationRepository {
  listDueSanctions(now: Date, limit?: number): Promise<DueSanction[]>;
  markSanctionExpired(id: string): Promise<void>;
  listDueWarnings(now: Date, limit?: number): Promise<DueWarning[]>;
  markWarningExpired(id: string): Promise<void>;
}

export class PrismaExpirationRepository implements ExpirationRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async listDueSanctions(now: Date, limit = 100): Promise<DueSanction[]> {
    const sanctions = await this.client.sanction.findMany({
      where: {
        status: "active",
        endsAt: { not: null, lte: now },
      },
      take: limit,
    });

    return sanctions.map((sanction) => {
      const payload = (sanction.payload ?? {}) as Record<string, unknown>;
      return {
        id: sanction.id,
        tenantId: sanction.tenantId,
        kind: sanction.kind,
        telegramUserId: readBigInt(payload.telegramUserId),
        telegramChatId: readBigInt(payload.telegramChatId),
      };
    });
  }

  async markSanctionExpired(id: string): Promise<void> {
    await this.client.sanction.update({
      where: { id },
      data: { status: "expired" },
    });
  }

  async listDueWarnings(now: Date, limit = 100): Promise<DueWarning[]> {
    const warnings = await this.client.warning.findMany({
      where: {
        expiredAt: null,
        expiresAt: { not: null, lte: now },
      },
      take: limit,
    });

    return warnings.map((warning) => ({
      id: warning.id,
      tenantId: warning.tenantId,
      userId: warning.userId,
    }));
  }

  async markWarningExpired(id: string): Promise<void> {
    await this.client.warning.update({
      where: { id },
      data: { expiredAt: new Date() },
    });
  }
}
