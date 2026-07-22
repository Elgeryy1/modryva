import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export interface ReputationProfileState {
  readonly telegramUserId: bigint;
  readonly points: number;
  readonly xp: number;
  /** Resolved display name (top() only); null when the user is unknown. */
  readonly name?: string | null;
}

export interface ReputationRepository {
  addPoints(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
    delta: number,
  ): Promise<ReputationProfileState>;
  addXp(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
    delta: number,
  ): Promise<ReputationProfileState>;
  getProfile(
    chatId: string,
    telegramUserId: bigint,
  ): Promise<ReputationProfileState | null>;
  top(chatId: string, limit: number): Promise<ReputationProfileState[]>;
}

const toState = (profile: {
  telegramUserId: bigint;
  points: number;
  xp: number;
}): ReputationProfileState => ({
  telegramUserId: profile.telegramUserId,
  points: profile.points,
  xp: profile.xp,
});

export class PrismaReputationRepository implements ReputationRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  private async bump(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
    field: "points" | "xp",
    delta: number,
  ): Promise<ReputationProfileState> {
    const profile = await this.client.reputationProfile.upsert({
      where: { chatId_telegramUserId: { chatId, telegramUserId } },
      create: {
        tenantId,
        chatId,
        telegramUserId,
        points: field === "points" ? delta : 0,
        xp: field === "xp" ? delta : 0,
      },
      update: { [field]: { increment: delta } },
    });

    return toState(profile);
  }

  addPoints(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
    delta: number,
  ): Promise<ReputationProfileState> {
    return this.bump(tenantId, chatId, telegramUserId, "points", delta);
  }

  addXp(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
    delta: number,
  ): Promise<ReputationProfileState> {
    return this.bump(tenantId, chatId, telegramUserId, "xp", delta);
  }

  async getProfile(
    chatId: string,
    telegramUserId: bigint,
  ): Promise<ReputationProfileState | null> {
    const profile = await this.client.reputationProfile.findUnique({
      where: { chatId_telegramUserId: { chatId, telegramUserId } },
    });

    return profile ? toState(profile) : null;
  }

  async top(chatId: string, limit: number): Promise<ReputationProfileState[]> {
    const profiles = await this.client.reputationProfile.findMany({
      where: { chatId },
      orderBy: [{ points: "desc" }, { xp: "desc" }],
      take: limit,
    });

    // ReputationProfile has no FK to AppUser, so resolve names in one batch
    // by the (globally unique) telegram id, same pattern as game-repository.
    const ids = profiles.map((profile) => profile.telegramUserId);
    const users =
      ids.length > 0
        ? await this.client.appUser.findMany({
            where: { telegramUserId: { in: ids } },
            select: { telegramUserId: true, displayName: true, username: true },
          })
        : [];
    const nameById = new Map<string, string>();
    for (const user of users) {
      const name =
        user.displayName ?? (user.username ? `@${user.username}` : null);
      if (name) {
        nameById.set(user.telegramUserId.toString(), name);
      }
    }

    return profiles.map((profile) => ({
      ...toState(profile),
      name: nameById.get(profile.telegramUserId.toString()) ?? null,
    }));
  }
}
