import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export interface FederationRecord {
  readonly fedId: string;
  readonly name: string;
  readonly ownerTelegramId: bigint;
  readonly logTelegramChatId: bigint | undefined;
  readonly subscribedFedId: string | undefined;
}

export interface FederationChatRecord {
  readonly chatId: string;
  readonly telegramChatId: bigint;
}

export interface FederationBanRecord {
  readonly subjectTelegramId: bigint;
  readonly reason: string | undefined;
}

export interface CreateFederationInput {
  readonly tenantId: string;
  readonly fedId: string;
  readonly name: string;
  readonly ownerTelegramId: bigint;
}

export interface FederationRepository {
  createFederation(input: CreateFederationInput): Promise<FederationRecord>;
  getFederation(fedId: string): Promise<FederationRecord | null>;
  /** The federation a chat belongs to, if any. */
  getFederationForChat(chatId: string): Promise<FederationRecord | null>;
  joinFederation(
    fedId: string,
    chatId: string,
    telegramChatId: bigint,
  ): Promise<void>;
  leaveFederation(chatId: string): Promise<boolean>;
  listFederationChats(fedId: string): Promise<FederationChatRecord[]>;
  renameFederation(fedId: string, name: string): Promise<void>;
  /** Deletes the federation and every chat/ban/admin row that references it. */
  deleteFederation(fedId: string): Promise<void>;
  setFedLog(fedId: string, logTelegramChatId: bigint): Promise<void>;
  /** `subscribedFedId: null` clears the subscription (no fed inherited). */
  setSubscribedFed(
    fedId: string,
    subscribedFedId: string | null,
  ): Promise<void>;
  addFedBan(input: {
    fedId: string;
    subjectTelegramId: bigint;
    reason: string | undefined;
    actorTelegramId: bigint | undefined;
  }): Promise<void>;
  removeFedBan(fedId: string, subjectTelegramId: bigint): Promise<boolean>;
  isFedBanned(
    fedId: string,
    subjectTelegramId: bigint,
  ): Promise<FederationBanRecord | null>;
  listFedBans(fedId: string): Promise<FederationBanRecord[]>;
  /** Every federation (by fedId) that has banned this user. */
  fedBansForUser(
    subjectTelegramId: bigint,
  ): Promise<{ fedId: string; reason: string | undefined }[]>;
  addFedAdmin(fedId: string, telegramUserId: bigint): Promise<void>;
  removeFedAdmin(fedId: string, telegramUserId: bigint): Promise<boolean>;
  isFedAdmin(fedId: string, telegramUserId: bigint): Promise<boolean>;
  listFedAdmins(fedId: string): Promise<bigint[]>;
  countFedChats(fedId: string): Promise<number>;
  countFedBans(fedId: string): Promise<number>;
  countFedAdmins(fedId: string): Promise<number>;
}

export class PrismaFederationRepository implements FederationRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async createFederation(
    input: CreateFederationInput,
  ): Promise<FederationRecord> {
    const fed = await this.client.federation.create({
      data: {
        tenantId: input.tenantId,
        fedId: input.fedId,
        name: input.name,
        ownerTelegramId: input.ownerTelegramId,
      },
    });
    return toFederation(fed);
  }

  async getFederation(fedId: string): Promise<FederationRecord | null> {
    const fed = await this.client.federation.findUnique({ where: { fedId } });
    return fed ? toFederation(fed) : null;
  }

  async getFederationForChat(chatId: string): Promise<FederationRecord | null> {
    const link = await this.client.federationChat.findUnique({
      where: { chatId },
    });
    if (!link) {
      return null;
    }
    return this.getFederation(link.fedId);
  }

  async joinFederation(
    fedId: string,
    chatId: string,
    telegramChatId: bigint,
  ): Promise<void> {
    await this.client.federationChat.upsert({
      where: { chatId },
      create: { fedId, chatId, telegramChatId },
      update: { fedId, telegramChatId },
    });
  }

  async leaveFederation(chatId: string): Promise<boolean> {
    const result = await this.client.federationChat.deleteMany({
      where: { chatId },
    });
    return result.count > 0;
  }

  async listFederationChats(fedId: string): Promise<FederationChatRecord[]> {
    const chats = await this.client.federationChat.findMany({
      where: { fedId },
    });
    return chats.map((chat) => ({
      chatId: chat.chatId,
      telegramChatId: chat.telegramChatId,
    }));
  }

  async renameFederation(fedId: string, name: string): Promise<void> {
    await this.client.federation.update({ where: { fedId }, data: { name } });
  }

  async deleteFederation(fedId: string): Promise<void> {
    await this.client.$transaction([
      this.client.federationChat.deleteMany({ where: { fedId } }),
      this.client.federationBan.deleteMany({ where: { fedId } }),
      this.client.federationAdmin.deleteMany({ where: { fedId } }),
      this.client.federation.delete({ where: { fedId } }),
    ]);
  }

  async setFedLog(fedId: string, logTelegramChatId: bigint): Promise<void> {
    await this.client.federation.update({
      where: { fedId },
      data: { logTelegramChatId },
    });
  }

  async setSubscribedFed(
    fedId: string,
    subscribedFedId: string | null,
  ): Promise<void> {
    await this.client.federation.update({
      where: { fedId },
      data: { subscribedFedId },
    });
  }

  async addFedBan(input: {
    fedId: string;
    subjectTelegramId: bigint;
    reason: string | undefined;
    actorTelegramId: bigint | undefined;
  }): Promise<void> {
    await this.client.federationBan.upsert({
      where: {
        fedId_subjectTelegramId: {
          fedId: input.fedId,
          subjectTelegramId: input.subjectTelegramId,
        },
      },
      create: {
        fedId: input.fedId,
        subjectTelegramId: input.subjectTelegramId,
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.actorTelegramId
          ? { actorTelegramId: input.actorTelegramId }
          : {}),
      },
      update: {
        ...(input.reason ? { reason: input.reason } : { reason: null }),
        ...(input.actorTelegramId
          ? { actorTelegramId: input.actorTelegramId }
          : {}),
      },
    });
  }

  async removeFedBan(
    fedId: string,
    subjectTelegramId: bigint,
  ): Promise<boolean> {
    const result = await this.client.federationBan.deleteMany({
      where: { fedId, subjectTelegramId },
    });
    return result.count > 0;
  }

  async isFedBanned(
    fedId: string,
    subjectTelegramId: bigint,
  ): Promise<FederationBanRecord | null> {
    const ban = await this.client.federationBan.findUnique({
      where: { fedId_subjectTelegramId: { fedId, subjectTelegramId } },
    });
    return ban ? { subjectTelegramId, reason: ban.reason ?? undefined } : null;
  }

  async listFedBans(fedId: string): Promise<FederationBanRecord[]> {
    const bans = await this.client.federationBan.findMany({ where: { fedId } });
    return bans.map((ban) => ({
      subjectTelegramId: ban.subjectTelegramId,
      reason: ban.reason ?? undefined,
    }));
  }

  async fedBansForUser(
    subjectTelegramId: bigint,
  ): Promise<{ fedId: string; reason: string | undefined }[]> {
    const bans = await this.client.federationBan.findMany({
      where: { subjectTelegramId },
    });
    return bans.map((ban) => ({
      fedId: ban.fedId,
      reason: ban.reason ?? undefined,
    }));
  }

  async addFedAdmin(fedId: string, telegramUserId: bigint): Promise<void> {
    await this.client.federationAdmin.upsert({
      where: { fedId_telegramUserId: { fedId, telegramUserId } },
      create: { fedId, telegramUserId },
      update: {},
    });
  }

  async removeFedAdmin(
    fedId: string,
    telegramUserId: bigint,
  ): Promise<boolean> {
    const result = await this.client.federationAdmin.deleteMany({
      where: { fedId, telegramUserId },
    });
    return result.count > 0;
  }

  async isFedAdmin(fedId: string, telegramUserId: bigint): Promise<boolean> {
    const admin = await this.client.federationAdmin.findUnique({
      where: { fedId_telegramUserId: { fedId, telegramUserId } },
    });
    return admin !== null;
  }

  async listFedAdmins(fedId: string): Promise<bigint[]> {
    const admins = await this.client.federationAdmin.findMany({
      where: { fedId },
    });
    return admins.map((admin) => admin.telegramUserId);
  }

  async countFedChats(fedId: string): Promise<number> {
    return this.client.federationChat.count({ where: { fedId } });
  }

  async countFedBans(fedId: string): Promise<number> {
    return this.client.federationBan.count({ where: { fedId } });
  }

  async countFedAdmins(fedId: string): Promise<number> {
    return this.client.federationAdmin.count({ where: { fedId } });
  }
}

const toFederation = (fed: {
  fedId: string;
  name: string;
  ownerTelegramId: bigint;
  logTelegramChatId: bigint | null;
  subscribedFedId: string | null;
}): FederationRecord => ({
  fedId: fed.fedId,
  name: fed.name,
  ownerTelegramId: fed.ownerTelegramId,
  logTelegramChatId: fed.logTelegramChatId ?? undefined,
  subscribedFedId: fed.subscribedFedId ?? undefined,
});

/**
 * In-memory federation store. Used as the default in tests (so the huge
 * BotUpdateService constructor does not need every test to pass a fake) and as a
 * safe fallback; production wires {@link PrismaFederationRepository}.
 */
export class InMemoryFederationRepository implements FederationRepository {
  private readonly feds = new Map<string, FederationRecord>();
  private readonly chats = new Map<
    string,
    FederationChatRecord & { fedId: string }
  >();
  private readonly bans = new Map<
    string,
    FederationBanRecord & { fedId: string }
  >();
  private readonly admins = new Set<string>();

  async createFederation(
    input: CreateFederationInput,
  ): Promise<FederationRecord> {
    const record: FederationRecord = {
      fedId: input.fedId,
      name: input.name,
      ownerTelegramId: input.ownerTelegramId,
      logTelegramChatId: undefined,
      subscribedFedId: undefined,
    };
    this.feds.set(input.fedId, record);
    return record;
  }

  async getFederation(fedId: string): Promise<FederationRecord | null> {
    return this.feds.get(fedId) ?? null;
  }

  async getFederationForChat(chatId: string): Promise<FederationRecord | null> {
    const link = this.chats.get(chatId);
    return link ? (this.feds.get(link.fedId) ?? null) : null;
  }

  async joinFederation(
    fedId: string,
    chatId: string,
    telegramChatId: bigint,
  ): Promise<void> {
    this.chats.set(chatId, { fedId, chatId, telegramChatId });
  }

  async leaveFederation(chatId: string): Promise<boolean> {
    return this.chats.delete(chatId);
  }

  async listFederationChats(fedId: string): Promise<FederationChatRecord[]> {
    return [...this.chats.values()]
      .filter((chat) => chat.fedId === fedId)
      .map((chat) => ({
        chatId: chat.chatId,
        telegramChatId: chat.telegramChatId,
      }));
  }

  async renameFederation(fedId: string, name: string): Promise<void> {
    const fed = this.feds.get(fedId);
    if (fed) {
      this.feds.set(fedId, { ...fed, name });
    }
  }

  async deleteFederation(fedId: string): Promise<void> {
    this.feds.delete(fedId);
    for (const [key, chat] of this.chats) {
      if (chat.fedId === fedId) {
        this.chats.delete(key);
      }
    }
    for (const [key, ban] of this.bans) {
      if (ban.fedId === fedId) {
        this.bans.delete(key);
      }
    }
    for (const key of [...this.admins]) {
      if (key.startsWith(`${fedId}:`)) {
        this.admins.delete(key);
      }
    }
  }

  async setFedLog(fedId: string, logTelegramChatId: bigint): Promise<void> {
    const fed = this.feds.get(fedId);
    if (fed) {
      this.feds.set(fedId, { ...fed, logTelegramChatId });
    }
  }

  async setSubscribedFed(
    fedId: string,
    subscribedFedId: string | null,
  ): Promise<void> {
    const fed = this.feds.get(fedId);
    if (fed) {
      this.feds.set(fedId, {
        ...fed,
        subscribedFedId: subscribedFedId ?? undefined,
      });
    }
  }

  async addFedBan(input: {
    fedId: string;
    subjectTelegramId: bigint;
    reason: string | undefined;
    actorTelegramId: bigint | undefined;
  }): Promise<void> {
    this.bans.set(`${input.fedId}:${input.subjectTelegramId}`, {
      fedId: input.fedId,
      subjectTelegramId: input.subjectTelegramId,
      reason: input.reason,
    });
  }

  async removeFedBan(
    fedId: string,
    subjectTelegramId: bigint,
  ): Promise<boolean> {
    return this.bans.delete(`${fedId}:${subjectTelegramId}`);
  }

  async isFedBanned(
    fedId: string,
    subjectTelegramId: bigint,
  ): Promise<FederationBanRecord | null> {
    return this.bans.get(`${fedId}:${subjectTelegramId}`) ?? null;
  }

  async listFedBans(fedId: string): Promise<FederationBanRecord[]> {
    return [...this.bans.values()]
      .filter((ban) => ban.fedId === fedId)
      .map((ban) => ({
        subjectTelegramId: ban.subjectTelegramId,
        reason: ban.reason,
      }));
  }

  async fedBansForUser(
    subjectTelegramId: bigint,
  ): Promise<{ fedId: string; reason: string | undefined }[]> {
    return [...this.bans.values()]
      .filter((ban) => ban.subjectTelegramId === subjectTelegramId)
      .map((ban) => ({ fedId: ban.fedId, reason: ban.reason }));
  }

  async addFedAdmin(fedId: string, telegramUserId: bigint): Promise<void> {
    this.admins.add(`${fedId}:${telegramUserId}`);
  }

  async removeFedAdmin(
    fedId: string,
    telegramUserId: bigint,
  ): Promise<boolean> {
    return this.admins.delete(`${fedId}:${telegramUserId}`);
  }

  async isFedAdmin(fedId: string, telegramUserId: bigint): Promise<boolean> {
    return this.admins.has(`${fedId}:${telegramUserId}`);
  }

  async listFedAdmins(fedId: string): Promise<bigint[]> {
    return [...this.admins]
      .filter((key) => key.startsWith(`${fedId}:`))
      .map((key) => BigInt(key.slice(fedId.length + 1)));
  }

  async countFedChats(fedId: string): Promise<number> {
    return (await this.listFederationChats(fedId)).length;
  }

  async countFedBans(fedId: string): Promise<number> {
    return (await this.listFedBans(fedId)).length;
  }

  async countFedAdmins(fedId: string): Promise<number> {
    return (await this.listFedAdmins(fedId)).length;
  }
}
