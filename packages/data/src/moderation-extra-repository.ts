import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export interface WarningSummary {
  readonly reason: string | null;
  readonly createdAt: Date;
}

export interface CreateReportInput {
  readonly tenantId: string;
  readonly chatId: string | undefined;
  readonly reporterUserId: string | undefined;
  readonly subjectTelegramId: bigint;
  readonly reason: string | undefined;
}

export interface WarnPolicyState {
  readonly warnLimit: number;
  readonly warnMode: string;
  readonly durationMs: number | undefined;
  readonly expireMs: number | undefined;
}

export interface WarnPolicyPatch {
  readonly warnLimit?: number;
  readonly warnMode?: string;
  readonly durationMs?: number | null;
  readonly expireMs?: number | null;
}

export interface ReportRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly chatId: string | undefined;
  readonly reporterUserId: string | undefined;
  readonly subjectTelegramId: bigint;
  readonly reason: string | undefined;
  readonly status: string;
  readonly createdAt: Date;
}

export interface ReportFilter {
  readonly tenantId: string;
  readonly chatId?: string;
  readonly status?: string;
  readonly limit?: number;
}

export const defaultWarnPolicyState: WarnPolicyState = {
  warnLimit: 3,
  warnMode: "mute",
  durationMs: undefined,
  expireMs: undefined,
};

export interface ModerationExtraRepository {
  countActiveWarnings(
    tenantId: string,
    chatId: string,
    subjectTelegramUserId: bigint,
  ): Promise<number>;
  listActiveWarnings(
    tenantId: string,
    chatId: string,
    subjectTelegramUserId: bigint,
    limit?: number,
  ): Promise<WarningSummary[]>;
  /** Expires the most recent active warning; returns remaining active count. */
  unwarn(
    tenantId: string,
    chatId: string,
    subjectTelegramUserId: bigint,
  ): Promise<number>;
  /** Expires all active warnings; returns the number cleared. */
  resetWarnings(
    tenantId: string,
    chatId: string,
    subjectTelegramUserId: bigint,
  ): Promise<number>;
  /** Expires one specific warning by id (for the inline "remove warn" button). */
  expireWarning(warningId: string): Promise<boolean>;
  createReport(input: CreateReportInput): Promise<string>;
  listReports(filter: ReportFilter): Promise<ReportRecord[]>;
  resolveReport(reportId: string, status: string): Promise<boolean>;
  getWarnPolicy(chatId: string): Promise<WarnPolicyState>;
  setWarnPolicy(
    tenantId: string,
    chatId: string,
    patch: WarnPolicyPatch,
  ): Promise<WarnPolicyState>;
}

export class PrismaModerationExtraRepository
  implements ModerationExtraRepository
{
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  private async subjectUserId(
    subjectTelegramUserId: bigint,
  ): Promise<string | null> {
    const user = await this.client.appUser.findUnique({
      where: { telegramUserId: subjectTelegramUserId },
    });
    return user?.id ?? null;
  }

  /** Warning has no chatId of its own — only via caseId -> ModerationCase.
   * Scoping every warn query to a chat's own case ids is what stops a
   * user's warnings in one group from leaking into another (or across
   * tenants entirely, since AppUser.telegramUserId is globally unique). */
  private async caseIdsForChat(
    tenantId: string,
    chatId: string,
  ): Promise<string[]> {
    const cases = await this.client.moderationCase.findMany({
      where: { tenantId, chatId },
      select: { id: true },
    });
    return cases.map((c) => c.id);
  }

  async countActiveWarnings(
    tenantId: string,
    chatId: string,
    subjectTelegramUserId: bigint,
  ): Promise<number> {
    const userId = await this.subjectUserId(subjectTelegramUserId);
    if (!userId) {
      return 0;
    }
    const caseIds = await this.caseIdsForChat(tenantId, chatId);
    if (caseIds.length === 0) {
      return 0;
    }
    return this.client.warning.count({
      where: { tenantId, userId, expiredAt: null, caseId: { in: caseIds } },
    });
  }

  async listActiveWarnings(
    tenantId: string,
    chatId: string,
    subjectTelegramUserId: bigint,
    limit = 20,
  ): Promise<WarningSummary[]> {
    const userId = await this.subjectUserId(subjectTelegramUserId);
    if (!userId) {
      return [];
    }
    const caseIds = await this.caseIdsForChat(tenantId, chatId);
    if (caseIds.length === 0) {
      return [];
    }
    const warnings = await this.client.warning.findMany({
      where: { tenantId, userId, expiredAt: null, caseId: { in: caseIds } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return warnings.map((warning) => ({
      reason: warning.reason,
      createdAt: warning.createdAt,
    }));
  }

  async unwarn(
    tenantId: string,
    chatId: string,
    subjectTelegramUserId: bigint,
  ): Promise<number> {
    const userId = await this.subjectUserId(subjectTelegramUserId);
    if (!userId) {
      return 0;
    }
    const caseIds = await this.caseIdsForChat(tenantId, chatId);
    if (caseIds.length === 0) {
      return 0;
    }
    const scope = {
      tenantId,
      userId,
      expiredAt: null,
      caseId: { in: caseIds },
    } as const;
    const latest = await this.client.warning.findFirst({
      where: scope,
      orderBy: { createdAt: "desc" },
    });
    if (latest) {
      await this.client.warning.update({
        where: { id: latest.id },
        data: { expiredAt: new Date() },
      });
    }
    return this.client.warning.count({ where: scope });
  }

  async resetWarnings(
    tenantId: string,
    chatId: string,
    subjectTelegramUserId: bigint,
  ): Promise<number> {
    const userId = await this.subjectUserId(subjectTelegramUserId);
    if (!userId) {
      return 0;
    }
    const caseIds = await this.caseIdsForChat(tenantId, chatId);
    if (caseIds.length === 0) {
      return 0;
    }
    const result = await this.client.warning.updateMany({
      where: { tenantId, userId, expiredAt: null, caseId: { in: caseIds } },
      data: { expiredAt: new Date() },
    });
    return result.count;
  }

  async expireWarning(warningId: string): Promise<boolean> {
    const result = await this.client.warning.updateMany({
      where: { id: warningId, expiredAt: null },
      data: { expiredAt: new Date() },
    });
    return result.count > 0;
  }

  async createReport(input: CreateReportInput): Promise<string> {
    const report = await this.client.report.create({
      data: {
        tenantId: input.tenantId,
        subjectTelegramId: input.subjectTelegramId,
        ...(input.chatId ? { chatId: input.chatId } : {}),
        ...(input.reporterUserId
          ? { reporterUserId: input.reporterUserId }
          : {}),
        ...(input.reason ? { reason: input.reason } : {}),
      },
    });
    return report.id;
  }

  async listReports(filter: ReportFilter): Promise<ReportRecord[]> {
    const reports = await this.client.report.findMany({
      where: {
        tenantId: filter.tenantId,
        ...(filter.chatId ? { chatId: filter.chatId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: filter.limit ?? 100,
    });
    return reports.map((report) => ({
      id: report.id,
      tenantId: report.tenantId,
      chatId: report.chatId ?? undefined,
      reporterUserId: report.reporterUserId ?? undefined,
      subjectTelegramId: report.subjectTelegramId,
      reason: report.reason ?? undefined,
      status: report.status,
      createdAt: report.createdAt,
    }));
  }

  async resolveReport(reportId: string, status: string): Promise<boolean> {
    const result = await this.client.report.updateMany({
      where: { id: reportId },
      data: { status },
    });
    return result.count > 0;
  }

  async getWarnPolicy(chatId: string): Promise<WarnPolicyState> {
    const config = await this.client.warnPolicyConfig.findUnique({
      where: { chatId },
    });

    if (!config) {
      return defaultWarnPolicyState;
    }

    return {
      warnLimit: config.warnLimit,
      warnMode: config.warnMode,
      durationMs:
        config.durationMs === null ? undefined : Number(config.durationMs),
      expireMs: config.expireMs === null ? undefined : Number(config.expireMs),
    };
  }

  async setWarnPolicy(
    tenantId: string,
    chatId: string,
    patch: WarnPolicyPatch,
  ): Promise<WarnPolicyState> {
    const data = {
      ...(patch.warnLimit !== undefined ? { warnLimit: patch.warnLimit } : {}),
      ...(patch.warnMode !== undefined ? { warnMode: patch.warnMode } : {}),
      ...(patch.durationMs !== undefined
        ? {
            durationMs:
              patch.durationMs === null ? null : BigInt(patch.durationMs),
          }
        : {}),
      ...(patch.expireMs !== undefined
        ? { expireMs: patch.expireMs === null ? null : BigInt(patch.expireMs) }
        : {}),
    };

    const config = await this.client.warnPolicyConfig.upsert({
      where: { chatId },
      create: { tenantId, chatId, ...data },
      update: data,
    });

    return {
      warnLimit: config.warnLimit,
      warnMode: config.warnMode,
      durationMs:
        config.durationMs === null ? undefined : Number(config.durationMs),
      expireMs: config.expireMs === null ? undefined : Number(config.expireMs),
    };
  }
}
