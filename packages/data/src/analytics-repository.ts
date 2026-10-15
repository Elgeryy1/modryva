import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export interface ActivityWindowRow {
  readonly day: string;
  readonly messages: number;
}

export interface TopPosterRow {
  readonly telegramUserId: bigint;
  readonly username: string | undefined;
  readonly messages: number;
}

/** Read-only activity aggregate for a current or observed group member. */
export interface MemberActivityProfileRow {
  readonly telegramUserId: bigint;
  readonly username: string | undefined;
  readonly membershipObservedAt: Date;
  readonly historyScannedAt: Date | undefined;
  readonly historicalMessages: number;
  readonly historicalLastMessageAt: Date | undefined;
  readonly liveMessages: number;
  readonly liveLastMessageAt: Date | undefined;
}

export interface AnalyticsRepository {
  recordMessage(tenantId: string, chatId: string, day: string): Promise<void>;
  getRecentDays(chatId: string, limit: number): Promise<ActivityWindowRow[]>;
  getTotal(chatId: string): Promise<number>;
  recordUserMessage(input: {
    tenantId: string;
    chatId: string;
    telegramUserId: bigint;
    username: string | undefined;
  }): Promise<void>;
  /** Record that the bot observed a member join, without reading their content. */
  observeMember?(input: {
    tenantId: string;
    chatId: string;
    telegramUserId: bigint;
    username?: string;
    observedAt?: Date;
  }): Promise<void>;
  getMemberActivityProfiles?(
    tenantId: string,
    chatId: string,
  ): Promise<readonly MemberActivityProfileRow[]>;
  /**
   * Resolve an @username to the numeric id, within one chat.
   *
   * Telegram's Bot API offers no username lookup at all — getChatMember needs
   * the id you are trying to find. The only handle-to-id mapping a bot ever
   * has is the one it recorded itself while watching the chat, so a member who
   * has never been seen here is genuinely unresolvable, not a lookup failure.
   */
  findMemberByUsername?(
    tenantId: string,
    chatId: string,
    username: string,
  ): Promise<MemberActivityProfileRow | undefined>;
  /** One member's activity aggregate, without scanning the whole chat. */
  getMemberActivityProfile?(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
  ): Promise<MemberActivityProfileRow | undefined>;
  getTopPosters(chatId: string, limit: number): Promise<TopPosterRow[]>;
  getActiveUserCount(chatId: string): Promise<number>;
  /**
   * Total de mensajes registrados de un usuario en un chat (para modulos como
   * trust-tiers que necesitan el contador plano de un solo miembro).
   */
  getUserMessages(chatId: string, telegramUserId: bigint): Promise<number>;
}

/** Prisma row -> domain row. Prisma spells "absent" as null; the domain uses
 * undefined, and every read of this table has to agree on which is which. */
const toMemberActivityProfileRow = (row: {
  telegramUserId: bigint;
  username: string | null;
  membershipObservedAt: Date;
  historyScannedAt: Date | null;
  historicalMessages: number;
  historicalLastMessageAt: Date | null;
  liveMessages: number;
  liveLastMessageAt: Date | null;
}): MemberActivityProfileRow => ({
  telegramUserId: row.telegramUserId,
  username: row.username ?? undefined,
  membershipObservedAt: row.membershipObservedAt,
  historyScannedAt: row.historyScannedAt ?? undefined,
  historicalMessages: row.historicalMessages,
  historicalLastMessageAt: row.historicalLastMessageAt ?? undefined,
  liveMessages: row.liveMessages,
  liveLastMessageAt: row.liveLastMessageAt ?? undefined,
});

export class PrismaAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async recordMessage(
    tenantId: string,
    chatId: string,
    day: string,
  ): Promise<void> {
    await this.client.activityDaily.upsert({
      where: { chatId_day: { chatId, day } },
      create: { tenantId, chatId, day, messages: 1 },
      update: { messages: { increment: 1 } },
    });
  }

  async getRecentDays(
    chatId: string,
    limit: number,
  ): Promise<ActivityWindowRow[]> {
    const rows = await this.client.activityDaily.findMany({
      where: { chatId },
      orderBy: { day: "desc" },
      take: limit,
    });

    return rows.map((row) => ({ day: row.day, messages: row.messages }));
  }

  async getTotal(chatId: string): Promise<number> {
    const result = await this.client.activityDaily.aggregate({
      where: { chatId },
      _sum: { messages: true },
    });

    return result._sum.messages ?? 0;
  }

  async recordUserMessage(input: {
    tenantId: string;
    chatId: string;
    telegramUserId: bigint;
    username: string | undefined;
  }): Promise<void> {
    const now = new Date();
    await this.client.$transaction([
      this.client.userActivity.upsert({
        where: {
          chatId_telegramUserId: {
            chatId: input.chatId,
            telegramUserId: input.telegramUserId,
          },
        },
        create: {
          tenantId: input.tenantId,
          chatId: input.chatId,
          telegramUserId: input.telegramUserId,
          ...(input.username ? { username: input.username } : {}),
          messages: 1,
        },
        update: {
          messages: { increment: 1 },
          ...(input.username ? { username: input.username } : {}),
        },
      }),
      this.client.memberActivityProfile.upsert({
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
          telegramUserId: input.telegramUserId,
          ...(input.username ? { username: input.username } : {}),
          membershipObservedAt: now,
          liveMessages: 1,
          liveLastMessageAt: now,
        },
        update: {
          liveMessages: { increment: 1 },
          liveLastMessageAt: now,
          ...(input.username ? { username: input.username } : {}),
        },
      }),
    ]);
  }

  async observeMember(input: {
    tenantId: string;
    chatId: string;
    telegramUserId: bigint;
    username?: string;
    observedAt?: Date;
  }): Promise<void> {
    const observedAt = input.observedAt ?? new Date();
    await this.client.memberActivityProfile.upsert({
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
        telegramUserId: input.telegramUserId,
        ...(input.username ? { username: input.username } : {}),
        membershipObservedAt: observedAt,
      },
      update: {
        membershipObservedAt: observedAt,
        ...(input.username ? { username: input.username } : {}),
      },
    });
  }

  async getMemberActivityProfiles(
    tenantId: string,
    chatId: string,
  ): Promise<readonly MemberActivityProfileRow[]> {
    const rows = await this.client.memberActivityProfile.findMany({
      where: { tenantId, chatId },
    });
    return rows.map(toMemberActivityProfileRow);
  }

  async getMemberActivityProfile(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
  ): Promise<MemberActivityProfileRow | undefined> {
    const row = await this.client.memberActivityProfile.findUnique({
      where: {
        tenantId_chatId_telegramUserId: { tenantId, chatId, telegramUserId },
      },
    });
    return row ? toMemberActivityProfileRow(row) : undefined;
  }

  async findMemberByUsername(
    tenantId: string,
    chatId: string,
    username: string,
  ): Promise<MemberActivityProfileRow | undefined> {
    const handle = username.replace(/^@/u, "").trim();
    if (handle.length === 0) {
      return undefined;
    }

    // Telegram handles are case-insensitive, so the stored casing (whatever the
    // person used the day the bot last saw them) must not decide the match.
    const row = await this.client.memberActivityProfile.findFirst({
      where: {
        tenantId,
        chatId,
        username: { equals: handle, mode: "insensitive" },
      },
      orderBy: { membershipObservedAt: "desc" },
    });
    return row ? toMemberActivityProfileRow(row) : undefined;
  }

  async getTopPosters(chatId: string, limit: number): Promise<TopPosterRow[]> {
    const rows = await this.client.userActivity.findMany({
      where: { chatId },
      orderBy: { messages: "desc" },
      take: limit,
    });

    return rows.map((row) => ({
      telegramUserId: row.telegramUserId,
      username: row.username ?? undefined,
      messages: row.messages,
    }));
  }

  async getActiveUserCount(chatId: string): Promise<number> {
    return this.client.userActivity.count({ where: { chatId } });
  }

  async getUserMessages(
    chatId: string,
    telegramUserId: bigint,
  ): Promise<number> {
    const row = await this.client.userActivity.findUnique({
      where: { chatId_telegramUserId: { chatId, telegramUserId } },
    });
    return row?.messages ?? 0;
  }
}
