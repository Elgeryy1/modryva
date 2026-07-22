import type { Prisma, PrismaClient, SanctionKind } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export interface ModerationRecordInput {
  readonly tenantId: string;
  readonly chatId: string | undefined;
  readonly actorUserId: string | undefined;
  readonly subjectTelegramUserId: bigint;
  readonly reason: string | undefined;
}

export interface CreateWarningInput extends ModerationRecordInput {
  readonly weight?: number;
}

export interface CreateSanctionInput extends ModerationRecordInput {
  readonly kind: SanctionKind;
  readonly endsAt?: Date;
  readonly telegramChatId?: bigint;
}

export interface ModerationRecordResult {
  readonly caseId: string;
  readonly caseNumber: number;
  readonly recordId: string;
  readonly subjectUserId: string;
}

export interface RevertSanctionsInput {
  readonly tenantId: string;
  readonly subjectTelegramUserId: bigint;
  readonly kind: SanctionKind;
}

/**
 * A real, already-persisted moderation case, read back for report/analysis
 * commands (conflict clustering, hot users, etc.). `targetTelegramUserId` is
 * recovered from the case's own JSON payload, so no join is required.
 */
export interface ModerationCaseSummary {
  readonly caseId: string;
  readonly targetTelegramUserId: bigint | undefined;
  readonly reason: string | undefined;
  readonly createdAt: Date;
}

/** A single sanction's kind and current status, for the chat that owns its case. */
export interface ChatSanctionOutcome {
  readonly kind: SanctionKind;
  readonly status: string;
}

export interface ModerationRepository {
  createWarning(input: CreateWarningInput): Promise<ModerationRecordResult>;
  createSanction(input: CreateSanctionInput): Promise<ModerationRecordResult>;
  revertSanctions(input: RevertSanctionsInput): Promise<number>;
  listRecentCases(
    tenantId: string,
    chatId: string,
    limit?: number,
  ): Promise<ModerationCaseSummary[]>;
  /**
   * Cuenta los warnings activos (sin `expiredAt`) de un usuario dentro de un
   * chat concreto, para modulos como trust-tiers que degradan el tier por
   * sanciones vigentes. 0 si el usuario no tiene AppUser o no hay warnings.
   */
  countActiveWarnings(
    tenantId: string,
    chatId: string,
    subjectTelegramUserId: bigint,
  ): Promise<number>;
  /**
   * Kind + status of recent sanctions tied to this chat's moderation cases,
   * for reports like reverted-actions-ranking. Two-step lookup (case ids for
   * the chat, then sanctions referencing those case ids) since `Sanction`
   * only carries a plain `caseId` string, not a Prisma relation.
   */
  listRecentSanctionsForChat(
    tenantId: string,
    chatId: string,
    limit?: number,
  ): Promise<ChatSanctionOutcome[]>;
}

const toJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

export class PrismaModerationRepository implements ModerationRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async createWarning(
    input: CreateWarningInput,
  ): Promise<ModerationRecordResult> {
    const subject = await this.ensureSubjectUser(input);
    const moderationCase = await this.createCase(input, subject.id);
    const warning = await this.client.warning.create({
      data: {
        tenantId: input.tenantId,
        userId: subject.id,
        caseId: moderationCase.id,
        weight: input.weight ?? 1,
        ...(input.reason ? { reason: input.reason } : {}),
      },
    });

    return {
      caseId: moderationCase.id,
      caseNumber: moderationCase.caseNumber,
      recordId: warning.id,
      subjectUserId: subject.id,
    };
  }

  async createSanction(
    input: CreateSanctionInput,
  ): Promise<ModerationRecordResult> {
    const subject = await this.ensureSubjectUser(input);
    const moderationCase = await this.createCase(input, subject.id);
    const sanction = await this.client.sanction.create({
      data: {
        tenantId: input.tenantId,
        userId: subject.id,
        caseId: moderationCase.id,
        kind: input.kind,
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.endsAt ? { endsAt: input.endsAt } : {}),
        payload: toJson({
          telegramUserId: input.subjectTelegramUserId.toString(),
          ...(input.telegramChatId
            ? { telegramChatId: input.telegramChatId.toString() }
            : {}),
        }),
      },
    });

    return {
      caseId: moderationCase.id,
      caseNumber: moderationCase.caseNumber,
      recordId: sanction.id,
      subjectUserId: subject.id,
    };
  }

  async revertSanctions(input: RevertSanctionsInput): Promise<number> {
    const subject = await this.client.appUser.findUnique({
      where: { telegramUserId: input.subjectTelegramUserId },
    });

    if (!subject) {
      return 0;
    }

    const result = await this.client.sanction.updateMany({
      where: {
        tenantId: input.tenantId,
        userId: subject.id,
        kind: input.kind,
        status: "active",
      },
      data: { status: "reverted" },
    });

    return result.count;
  }

  async listRecentCases(
    tenantId: string,
    chatId: string,
    limit = 100,
  ): Promise<ModerationCaseSummary[]> {
    const cases = await this.client.moderationCase.findMany({
      where: { tenantId, chatId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return cases.map((moderationCase) => {
      const payload = moderationCase.payload as {
        subjectTelegramUserId?: string;
      } | null;
      const targetTelegramUserId = payload?.subjectTelegramUserId
        ? BigInt(payload.subjectTelegramUserId)
        : undefined;
      return {
        caseId: moderationCase.id,
        targetTelegramUserId,
        reason: moderationCase.reason ?? undefined,
        createdAt: moderationCase.createdAt,
      };
    });
  }

  async countActiveWarnings(
    tenantId: string,
    chatId: string,
    subjectTelegramUserId: bigint,
  ): Promise<number> {
    const subject = await this.client.appUser.findUnique({
      where: { telegramUserId: subjectTelegramUserId },
    });
    if (!subject) {
      return 0;
    }

    const cases = await this.client.moderationCase.findMany({
      where: { tenantId, chatId },
      select: { id: true },
    });
    const caseIds = cases.map((moderationCase) => moderationCase.id);
    if (caseIds.length === 0) {
      return 0;
    }

    return this.client.warning.count({
      where: {
        tenantId,
        userId: subject.id,
        expiredAt: null,
        caseId: { in: caseIds },
      },
    });
  }

  async listRecentSanctionsForChat(
    tenantId: string,
    chatId: string,
    limit = 100,
  ): Promise<ChatSanctionOutcome[]> {
    const cases = await this.client.moderationCase.findMany({
      where: { tenantId, chatId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true },
    });
    const caseIds = cases.map((moderationCase) => moderationCase.id);
    if (caseIds.length === 0) {
      return [];
    }

    const sanctions = await this.client.sanction.findMany({
      where: { tenantId, caseId: { in: caseIds } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { kind: true, status: true },
    });
    return sanctions.map((sanction) => ({
      kind: sanction.kind,
      status: sanction.status,
    }));
  }

  private async ensureSubjectUser(input: ModerationRecordInput) {
    const existing = await this.client.appUser.findUnique({
      where: { telegramUserId: input.subjectTelegramUserId },
    });

    if (existing) {
      return this.client.appUser.update({
        where: { id: existing.id },
        data: {
          tenantId: existing.tenantId ?? input.tenantId,
        },
      });
    }

    return this.client.appUser.create({
      data: {
        tenantId: input.tenantId,
        telegramUserId: input.subjectTelegramUserId,
      },
    });
  }

  private async createCase(
    input: ModerationRecordInput,
    subjectUserId: string,
  ) {
    const latest = await this.client.moderationCase.aggregate({
      where: { tenantId: input.tenantId },
      _max: { caseNumber: true },
    });
    const caseNumber = (latest._max.caseNumber ?? 0) + 1;
    const data: Prisma.ModerationCaseUncheckedCreateInput = {
      tenantId: input.tenantId,
      caseNumber,
      subjectUserId,
      status: "open",
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.chatId ? { chatId: input.chatId } : {}),
      payload: toJson({
        actorUserId: input.actorUserId,
        subjectTelegramUserId: input.subjectTelegramUserId.toString(),
      }),
    };

    return this.client.moderationCase.create({ data });
  }
}
