import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * Per-admin moderation-decision history: one row per action an admin applies
 * (warn, mute, kick, ban, delete, ...), tagged with the rule/context that
 * triggered it (`ruleId`). Feeds two audit detectors in
 * `modules/security/src` that need this history but have no I/O of their
 * own: `aggressive-admin.ts` (detectAggressiveAdmins, needs a per-admin
 * sanction COUNT) and `consistency-check.ts` (detectInconsistency, needs
 * {adminId, caseKind, action} records). Neither is derivable from the
 * existing ModerationCase/Sanction/Warning tables today: those key off the
 * *subject* user, not the acting admin, and the only admin reference
 * (`ModerationCase.payload.actorUserId`) is unindexed JSON and only covers
 * the warn/sanction flow, not every moderation action (e.g. plain kicks).
 */

/** One moderation decision applied by an admin, to be recorded verbatim. */
export interface RecordAdminDecisionInput {
  readonly tenantId: string;
  readonly chatId: string;
  /** Telegram user id of the admin who applied the action. */
  readonly adminId: bigint;
  /** e.g. "warn" | "mute" | "kick" | "ban" | "delete". Free-form, lowercased by callers. */
  readonly action: string;
  /** The rule/case-kind/context that triggered this decision, if known. */
  readonly ruleId?: string;
}

/** A recorded decision, read back for audit reports. */
export interface AdminDecisionEntry {
  readonly adminId: bigint;
  readonly action: string;
  readonly ruleId: string | undefined;
  readonly occurredAt: Date;
}

export interface AdminDecisionRepository {
  /** Appends one decision to the history. Never mutates or dedupes. */
  record(input: RecordAdminDecisionInput): Promise<void>;
  /**
   * Most recent decisions for a chat, newest first, for the two audit
   * detectors (aggressive-admin, consistency-check) to aggregate over.
   */
  listRecent(
    tenantId: string,
    chatId: string,
    limit?: number,
  ): Promise<AdminDecisionEntry[]>;
}

const MAX_PER_CHAT = 1000;

export class PrismaAdminDecisionRepository implements AdminDecisionRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async record(input: RecordAdminDecisionInput): Promise<void> {
    await this.client.adminDecision.create({
      data: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        adminId: input.adminId,
        action: input.action,
        ruleId: input.ruleId ?? null,
      },
    });
  }

  async listRecent(
    tenantId: string,
    chatId: string,
    limit = 200,
  ): Promise<AdminDecisionEntry[]> {
    const rows = await this.client.adminDecision.findMany({
      where: { tenantId, chatId },
      orderBy: { occurredAt: "desc" },
      take: limit,
    });
    return rows.map((row) => ({
      adminId: row.adminId,
      action: row.action,
      ruleId: row.ruleId ?? undefined,
      occurredAt: row.occurredAt,
    }));
  }
}

/** Store en memoria usado como default del constructor (tests). */
export class InMemoryAdminDecisionRepository implements AdminDecisionRepository {
  private readonly decisions = new Map<
    string,
    Array<AdminDecisionEntry>
  >();

  private key(tenantId: string, chatId: string): string {
    return `${tenantId}:${chatId}`;
  }

  async record(input: RecordAdminDecisionInput): Promise<void> {
    const key = this.key(input.tenantId, input.chatId);
    const entry: AdminDecisionEntry = {
      adminId: input.adminId,
      action: input.action,
      ruleId: input.ruleId,
      occurredAt: new Date(),
    };
    const list = this.decisions.get(key) ?? [];
    list.unshift(entry);
    if (list.length > MAX_PER_CHAT) {
      list.length = MAX_PER_CHAT;
    }
    this.decisions.set(key, list);
  }

  async listRecent(
    tenantId: string,
    chatId: string,
    limit = 200,
  ): Promise<AdminDecisionEntry[]> {
    const list = this.decisions.get(this.key(tenantId, chatId)) ?? [];
    return list.slice(0, limit);
  }
}
