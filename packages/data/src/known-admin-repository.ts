import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * Tracks which chat admins were promoted through Modryva (via /promote),
 * as opposed to promoted directly in Telegram, bypassing the bot. Read back
 * by the external-admin audit command (`detectExternalPromotions` in
 * modules/security/src/external-admin.ts) to diff against Telegram's live
 * `getChatAdministrators` result and flag any admin id this repository never
 * recorded. This is audit/alert bookkeeping only — it never grants, revokes,
 * or otherwise enforces admin rights; it just remembers who the bot promoted.
 */
export interface KnownAdminRepository {
  /** Marks `adminId` as a known (Modryva-tracked) admin for this chat. Idempotent. */
  addKnownAdmin(
    tenantId: string,
    chatId: string,
    adminId: bigint,
  ): Promise<void>;
  /** Every admin id tracked as known for this chat, in no particular order. */
  listKnownAdmins(
    tenantId: string,
    chatId: string,
  ): Promise<readonly bigint[]>;
  /**
   * Stops tracking `adminId` as known for this chat (e.g. after a /demote).
   * A no-op if the id was never tracked.
   */
  removeKnownAdmin(
    tenantId: string,
    chatId: string,
    adminId: bigint,
  ): Promise<void>;
}

export class PrismaKnownAdminRepository implements KnownAdminRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async addKnownAdmin(
    tenantId: string,
    chatId: string,
    adminId: bigint,
  ): Promise<void> {
    await this.client.knownAdmin.upsert({
      where: { tenantId_chatId_adminId: { tenantId, chatId, adminId } },
      create: { tenantId, chatId, adminId },
      update: {},
    });
  }

  async listKnownAdmins(
    tenantId: string,
    chatId: string,
  ): Promise<readonly bigint[]> {
    const rows = await this.client.knownAdmin.findMany({
      where: { tenantId, chatId },
    });
    return rows.map((row) => row.adminId);
  }

  async removeKnownAdmin(
    tenantId: string,
    chatId: string,
    adminId: bigint,
  ): Promise<void> {
    await this.client.knownAdmin.deleteMany({
      where: { tenantId, chatId, adminId },
    });
  }
}

/** Store en memoria usado como default del constructor (tests). */
export class InMemoryKnownAdminRepository implements KnownAdminRepository {
  private readonly byChat = new Map<string, Set<bigint>>();

  private keyFor(tenantId: string, chatId: string): string {
    return `${tenantId} ${chatId}`;
  }

  async addKnownAdmin(
    tenantId: string,
    chatId: string,
    adminId: bigint,
  ): Promise<void> {
    const key = this.keyFor(tenantId, chatId);
    const set = this.byChat.get(key) ?? new Set<bigint>();
    set.add(adminId);
    this.byChat.set(key, set);
  }

  async listKnownAdmins(
    tenantId: string,
    chatId: string,
  ): Promise<readonly bigint[]> {
    const set = this.byChat.get(this.keyFor(tenantId, chatId));
    return set ? [...set] : [];
  }

  async removeKnownAdmin(
    tenantId: string,
    chatId: string,
    adminId: bigint,
  ): Promise<void> {
    this.byChat.get(this.keyFor(tenantId, chatId))?.delete(adminId);
  }
}
