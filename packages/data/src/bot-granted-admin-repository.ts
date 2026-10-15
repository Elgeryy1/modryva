import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * The administrators THIS BOT appointed, and therefore the only ones it is able
 * to demote — Telegram forbids a bot from demoting an admin it did not promote.
 *
 * Distinct from KnownAdminRepository, which is audit bookkeeping: that one
 * answers "was this admin promoted through Modryva at some point", forgets rows
 * on demote, and never gates an action. This one is the enforcement ledger. It
 * keeps revoked rows on purpose (who was trusted, and why it ended, is the
 * point) and carries the raw Telegram ids the Bot API needs to act without a
 * second lookup.
 */

export interface BotGrantedAdminRecord {
  readonly id: string;
  readonly telegramChatId: bigint;
  readonly telegramUserId: bigint;
  readonly username: string | null;
  readonly displayName: string | null;
  readonly customTitle: string | null;
  readonly grantedByTelegramId: bigint;
  readonly grantedAt: Date;
  readonly status: string;
  readonly revokedAt: Date | null;
  readonly revokedReason: string | null;
  readonly adoptedExisting: boolean;
}

export interface GrantAdminInput {
  readonly tenantId: string;
  readonly chatId: string;
  readonly telegramChatId: bigint;
  readonly telegramUserId: bigint;
  readonly username?: string | null;
  readonly displayName?: string | null;
  readonly customTitle?: string | null;
  readonly grantedByTelegramId: bigint;
  readonly adoptedExisting?: boolean;
}

export interface BotGrantedAdminRepository {
  /**
   * Records an appointment. Re-appointing someone previously revoked flips the
   * row back to active and clears the revocation, rather than adding a second
   * row — the unique key is (tenant, chat, user), and "is this person currently
   * ours to revoke?" must have exactly one answer.
   */
  grant(input: GrantAdminInput): Promise<BotGrantedAdminRecord>;
  /**
   * Marks an appointment revoked. Returns the row as it was BEFORE, or null if
   * there was no active appointment — callers use that null to avoid announcing
   * a demotion they never actually performed.
   */
  revoke(input: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly telegramUserId: bigint;
    readonly reason: string;
  }): Promise<BotGrantedAdminRecord | null>;
  /** The active appointment for this person here, if any. */
  findActive(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
  ): Promise<BotGrantedAdminRecord | null>;
  /**
   * Same question, answered from the RAW Telegram chat id. Enforcement runs off
   * a chat_member update, which carries no internal cuid; making it resolve the
   * chat first would put a lookup between a raid and the response to it.
   */
  findActiveByTelegramChat(
    telegramChatId: bigint,
    telegramUserId: bigint,
  ): Promise<BotGrantedAdminRecord | null>;
  /** Appointments for a chat, newest first. `status` filters when given. */
  list(
    tenantId: string,
    chatId: string,
    status?: string,
  ): Promise<readonly BotGrantedAdminRecord[]>;
}

const toRecord = (row: {
  id: string;
  telegramChatId: bigint;
  telegramUserId: bigint;
  username: string | null;
  displayName: string | null;
  customTitle: string | null;
  grantedByTelegramId: bigint;
  grantedAt: Date;
  status: string;
  revokedAt: Date | null;
  revokedReason: string | null;
  adoptedExisting: boolean;
}): BotGrantedAdminRecord => ({
  id: row.id,
  telegramChatId: row.telegramChatId,
  telegramUserId: row.telegramUserId,
  username: row.username,
  displayName: row.displayName,
  customTitle: row.customTitle,
  grantedByTelegramId: row.grantedByTelegramId,
  grantedAt: row.grantedAt,
  status: row.status,
  revokedAt: row.revokedAt,
  revokedReason: row.revokedReason,
  adoptedExisting: row.adoptedExisting,
});

export class PrismaBotGrantedAdminRepository
  implements BotGrantedAdminRepository
{
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async grant(input: GrantAdminInput): Promise<BotGrantedAdminRecord> {
    const shared = {
      username: input.username ?? null,
      displayName: input.displayName ?? null,
      customTitle: input.customTitle ?? null,
      grantedByTelegramId: input.grantedByTelegramId,
      adoptedExisting: input.adoptedExisting ?? false,
    };
    const row = await this.client.botGrantedAdmin.upsert({
      where: {
        tenantId_chatId_telegramUserId: {
          tenantId: input.tenantId,
          chatId: input.chatId,
          telegramUserId: input.telegramUserId,
        },
      },
      create: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        telegramChatId: input.telegramChatId,
        telegramUserId: input.telegramUserId,
        ...shared,
      },
      update: {
        ...shared,
        // A fresh appointment supersedes an old revocation completely; leaving
        // revokedReason set would make an active admin look revoked.
        status: "active",
        grantedAt: new Date(),
        revokedAt: null,
        revokedReason: null,
      },
    });
    return toRecord(row);
  }

  async revoke(input: {
    tenantId: string;
    chatId: string;
    telegramUserId: bigint;
    reason: string;
  }): Promise<BotGrantedAdminRecord | null> {
    const existing = await this.findActive(
      input.tenantId,
      input.chatId,
      input.telegramUserId,
    );
    if (!existing) {
      return null;
    }
    await this.client.botGrantedAdmin.update({
      where: { id: existing.id },
      data: {
        status: "revoked",
        revokedAt: new Date(),
        revokedReason: input.reason,
      },
    });
    return existing;
  }

  async findActive(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
  ): Promise<BotGrantedAdminRecord | null> {
    const row = await this.client.botGrantedAdmin.findUnique({
      where: {
        tenantId_chatId_telegramUserId: { tenantId, chatId, telegramUserId },
      },
    });
    return row && row.status === "active" ? toRecord(row) : null;
  }

  async findActiveByTelegramChat(
    telegramChatId: bigint,
    telegramUserId: bigint,
  ): Promise<BotGrantedAdminRecord | null> {
    const row = await this.client.botGrantedAdmin.findFirst({
      where: { telegramChatId, telegramUserId, status: "active" },
    });
    return row ? toRecord(row) : null;
  }

  async list(
    tenantId: string,
    chatId: string,
    status?: string,
  ): Promise<readonly BotGrantedAdminRecord[]> {
    const rows = await this.client.botGrantedAdmin.findMany({
      where: { tenantId, chatId, ...(status ? { status } : {}) },
      orderBy: { grantedAt: "desc" },
    });
    return rows.map(toRecord);
  }
}

/** Test double — same contract, no database. */
export class InMemoryBotGrantedAdminRepository
  implements BotGrantedAdminRepository
{
  private readonly rows = new Map<string, BotGrantedAdminRecord>();
  private seq = 0;

  private key(tenantId: string, chatId: string, userId: bigint): string {
    return `${tenantId}|${chatId}|${userId.toString()}`;
  }

  async grant(input: GrantAdminInput): Promise<BotGrantedAdminRecord> {
    const key = this.key(input.tenantId, input.chatId, input.telegramUserId);
    const record: BotGrantedAdminRecord = {
      id: this.rows.get(key)?.id ?? `bga-${++this.seq}`,
      telegramChatId: input.telegramChatId,
      telegramUserId: input.telegramUserId,
      username: input.username ?? null,
      displayName: input.displayName ?? null,
      customTitle: input.customTitle ?? null,
      grantedByTelegramId: input.grantedByTelegramId,
      grantedAt: new Date(),
      status: "active",
      revokedAt: null,
      revokedReason: null,
      adoptedExisting: input.adoptedExisting ?? false,
    };
    this.rows.set(key, record);
    return record;
  }

  async revoke(input: {
    tenantId: string;
    chatId: string;
    telegramUserId: bigint;
    reason: string;
  }): Promise<BotGrantedAdminRecord | null> {
    const key = this.key(input.tenantId, input.chatId, input.telegramUserId);
    const existing = this.rows.get(key);
    if (existing?.status !== "active") {
      return null;
    }
    this.rows.set(key, {
      ...existing,
      status: "revoked",
      revokedAt: new Date(),
      revokedReason: input.reason,
    });
    return existing;
  }

  async findActive(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
  ): Promise<BotGrantedAdminRecord | null> {
    const row = this.rows.get(this.key(tenantId, chatId, telegramUserId));
    return row && row.status === "active" ? row : null;
  }

  async findActiveByTelegramChat(
    telegramChatId: bigint,
    telegramUserId: bigint,
  ): Promise<BotGrantedAdminRecord | null> {
    return (
      [...this.rows.values()].find(
        (row) =>
          row.telegramChatId === telegramChatId &&
          row.telegramUserId === telegramUserId &&
          row.status === "active",
      ) ?? null
    );
  }

  async list(
    tenantId: string,
    chatId: string,
    status?: string,
  ): Promise<readonly BotGrantedAdminRecord[]> {
    const prefix = `${tenantId}|${chatId}|`;
    return [...this.rows.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, row]) => row)
      .filter((row) => !status || row.status === status)
      .sort((a, b) => b.grantedAt.getTime() - a.grantedAt.getTime());
  }
}
