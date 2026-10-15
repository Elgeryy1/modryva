import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export const INTERNAL_ROLES = [
  "owner",
  "network_manager",
  "moderator",
  "support",
  "analyst",
  "read_only",
] as const;
export type InternalRole = (typeof INTERNAL_ROLES)[number];

export const isInternalRole = (value: string): value is InternalRole =>
  (INTERNAL_ROLES as readonly string[]).includes(value);

export interface InternalRoleRecord {
  readonly telegramUserId: bigint;
  readonly role: InternalRole;
}

export interface UserPanelNoteRecord {
  readonly id: string;
  readonly fedId: string;
  readonly subjectTelegramUserId: bigint;
  readonly authorTelegramUserId: bigint;
  readonly note: string;
  readonly createdAt: Date;
}

export interface InternalRoleRepository {
  getRole(fedId: string, telegramUserId: bigint): Promise<InternalRole | null>;
  setRole(
    tenantId: string,
    fedId: string,
    telegramUserId: bigint,
    role: InternalRole,
  ): Promise<void>;
  removeRole(fedId: string, telegramUserId: bigint): Promise<void>;
  listRoles(fedId: string): Promise<InternalRoleRecord[]>;
  addNote(input: {
    tenantId: string;
    fedId: string;
    subjectTelegramUserId: bigint;
    authorTelegramUserId: bigint;
    note: string;
  }): Promise<UserPanelNoteRecord>;
  listNotes(
    fedId: string,
    subjectTelegramUserId: bigint,
    limit?: number,
  ): Promise<UserPanelNoteRecord[]>;
}

export class PrismaInternalRoleRepository implements InternalRoleRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async getRole(
    fedId: string,
    telegramUserId: bigint,
  ): Promise<InternalRole | null> {
    const row = await this.client.ownerNetworkUserRole.findUnique({
      where: { fedId_telegramUserId: { fedId, telegramUserId } },
    });
    return row && isInternalRole(row.role) ? row.role : null;
  }

  async setRole(
    tenantId: string,
    fedId: string,
    telegramUserId: bigint,
    role: InternalRole,
  ): Promise<void> {
    await this.client.ownerNetworkUserRole.upsert({
      where: { fedId_telegramUserId: { fedId, telegramUserId } },
      create: { tenantId, fedId, telegramUserId, role },
      update: { role },
    });
  }

  async removeRole(fedId: string, telegramUserId: bigint): Promise<void> {
    await this.client.ownerNetworkUserRole.deleteMany({
      where: { fedId, telegramUserId },
    });
  }

  async listRoles(fedId: string): Promise<InternalRoleRecord[]> {
    const rows = await this.client.ownerNetworkUserRole.findMany({
      where: { fedId },
      orderBy: { telegramUserId: "asc" },
    });
    return rows
      .filter((row) => isInternalRole(row.role))
      .map((row) => ({
        telegramUserId: row.telegramUserId,
        role: row.role as InternalRole,
      }));
  }

  async addNote(input: {
    tenantId: string;
    fedId: string;
    subjectTelegramUserId: bigint;
    authorTelegramUserId: bigint;
    note: string;
  }): Promise<UserPanelNoteRecord> {
    const row = await this.client.ownerNetworkUserNote.create({
      data: input,
    });
    return toNoteRecord(row);
  }

  async listNotes(
    fedId: string,
    subjectTelegramUserId: bigint,
    limit = 20,
  ): Promise<UserPanelNoteRecord[]> {
    const rows = await this.client.ownerNetworkUserNote.findMany({
      where: { fedId, subjectTelegramUserId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(toNoteRecord);
  }
}

export class InMemoryInternalRoleRepository implements InternalRoleRepository {
  private readonly roles = new Map<string, InternalRoleRecord>();
  private readonly notes = new Map<string, UserPanelNoteRecord[]>();
  private noteSeq = 0;

  private key(fedId: string, telegramUserId: bigint): string {
    return `${fedId}:${telegramUserId}`;
  }

  async getRole(
    fedId: string,
    telegramUserId: bigint,
  ): Promise<InternalRole | null> {
    return this.roles.get(this.key(fedId, telegramUserId))?.role ?? null;
  }

  async setRole(
    _tenantId: string,
    fedId: string,
    telegramUserId: bigint,
    role: InternalRole,
  ): Promise<void> {
    this.roles.set(this.key(fedId, telegramUserId), { telegramUserId, role });
  }

  async removeRole(fedId: string, telegramUserId: bigint): Promise<void> {
    this.roles.delete(this.key(fedId, telegramUserId));
  }

  async listRoles(fedId: string): Promise<InternalRoleRecord[]> {
    return [...this.roles.entries()]
      .filter(([key]) => key.startsWith(`${fedId}:`))
      .map(([, record]) => record)
      .sort((a, b) => (a.telegramUserId < b.telegramUserId ? -1 : 1));
  }

  async addNote(input: {
    tenantId: string;
    fedId: string;
    subjectTelegramUserId: bigint;
    authorTelegramUserId: bigint;
    note: string;
  }): Promise<UserPanelNoteRecord> {
    void input.tenantId;
    this.noteSeq += 1;
    const record: UserPanelNoteRecord = {
      id: `note_${this.noteSeq}`,
      fedId: input.fedId,
      subjectTelegramUserId: input.subjectTelegramUserId,
      authorTelegramUserId: input.authorTelegramUserId,
      note: input.note,
      createdAt: new Date(),
    };
    const key = this.key(input.fedId, input.subjectTelegramUserId);
    this.notes.set(key, [record, ...(this.notes.get(key) ?? [])]);
    return record;
  }

  async listNotes(
    fedId: string,
    subjectTelegramUserId: bigint,
    limit = 20,
  ): Promise<UserPanelNoteRecord[]> {
    return (this.notes.get(this.key(fedId, subjectTelegramUserId)) ?? []).slice(
      0,
      limit,
    );
  }
}

const toNoteRecord = (row: {
  id: string;
  fedId: string;
  subjectTelegramUserId: bigint;
  authorTelegramUserId: bigint;
  note: string;
  createdAt: Date;
}): UserPanelNoteRecord => ({
  id: row.id,
  fedId: row.fedId,
  subjectTelegramUserId: row.subjectTelegramUserId,
  authorTelegramUserId: row.authorTelegramUserId,
  note: row.note,
  createdAt: row.createdAt,
});
