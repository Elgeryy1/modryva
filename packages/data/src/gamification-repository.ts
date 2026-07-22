import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export const GAMIFICATION_MISSION_KINDS = [
  "first_message",
  "read_rules",
  "joined_required_group",
] as const;
export type GamificationMissionKind =
  (typeof GAMIFICATION_MISSION_KINDS)[number];

export interface GamificationMissionRecord {
  readonly fedId: string;
  readonly telegramUserId: bigint;
  readonly kind: GamificationMissionKind;
  readonly completedAt: Date | null;
}

export interface NetworkRankingEntry {
  readonly telegramUserId: bigint;
  readonly badgeCount: number;
}

export interface WelcomeButtonsState {
  readonly rules: boolean;
  readonly otherGroups: boolean;
  readonly support: boolean;
  readonly verify: boolean;
}

export interface GamificationRepository {
  ensureMissions(
    tenantId: string,
    fedId: string,
    telegramUserId: bigint,
  ): Promise<GamificationMissionRecord[]>;
  completeMission(
    tenantId: string,
    fedId: string,
    telegramUserId: bigint,
    kind: GamificationMissionKind,
  ): Promise<{ completed: boolean; alreadyDone: boolean }>;
  awardBadge(
    tenantId: string,
    fedId: string,
    telegramUserId: bigint,
    badge: string,
  ): Promise<{ awarded: boolean }>;
  listBadges(fedId: string, telegramUserId: bigint): Promise<string[]>;
  listMissions(
    fedId: string,
    telegramUserId: bigint,
  ): Promise<GamificationMissionRecord[]>;
  getNetworkRanking(
    fedId: string,
    limit: number,
  ): Promise<NetworkRankingEntry[]>;
  getWelcomeButtons(
    tenantId: string,
    chatId: string,
  ): Promise<WelcomeButtonsState>;
  setWelcomeButtons(
    tenantId: string,
    chatId: string,
    state: WelcomeButtonsState,
  ): Promise<WelcomeButtonsState>;
}

const DEFAULT_WELCOME_BUTTONS: WelcomeButtonsState = {
  rules: true,
  otherGroups: true,
  support: true,
  verify: false,
};

const isMissionKind = (value: string): value is GamificationMissionKind =>
  GAMIFICATION_MISSION_KINDS.some((kind) => kind === value);

const toMissionRecord = (row: {
  fedId: string;
  telegramUserId: bigint;
  kind: string;
  completedAt: Date | null;
}): GamificationMissionRecord => ({
  fedId: row.fedId,
  telegramUserId: row.telegramUserId,
  kind: isMissionKind(row.kind) ? row.kind : "first_message",
  completedAt: row.completedAt,
});

export class PrismaGamificationRepository implements GamificationRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async ensureMissions(
    tenantId: string,
    fedId: string,
    telegramUserId: bigint,
  ): Promise<GamificationMissionRecord[]> {
    await this.client.ownerNetworkMission.createMany({
      data: GAMIFICATION_MISSION_KINDS.map((kind) => ({
        tenantId,
        fedId,
        telegramUserId,
        kind,
      })),
      skipDuplicates: true,
    });
    return this.listMissions(fedId, telegramUserId);
  }

  async completeMission(
    tenantId: string,
    fedId: string,
    telegramUserId: bigint,
    kind: GamificationMissionKind,
  ): Promise<{ completed: boolean; alreadyDone: boolean }> {
    const existing = await this.client.ownerNetworkMission.findUnique({
      where: {
        fedId_telegramUserId_kind: { fedId, telegramUserId, kind },
      },
    });

    if (existing?.completedAt) {
      return { completed: true, alreadyDone: true };
    }

    await this.client.ownerNetworkMission.upsert({
      where: {
        fedId_telegramUserId_kind: { fedId, telegramUserId, kind },
      },
      create: {
        tenantId,
        fedId,
        telegramUserId,
        kind,
        completedAt: new Date(),
      },
      update: { completedAt: new Date() },
    });

    return { completed: true, alreadyDone: false };
  }

  async awardBadge(
    tenantId: string,
    fedId: string,
    telegramUserId: bigint,
    badge: string,
  ): Promise<{ awarded: boolean }> {
    const existing = await this.client.ownerNetworkBadge.findUnique({
      where: {
        fedId_telegramUserId_badge: { fedId, telegramUserId, badge },
      },
    });
    if (existing) {
      return { awarded: false };
    }

    await this.client.ownerNetworkBadge.create({
      data: { tenantId, fedId, telegramUserId, badge },
    });
    return { awarded: true };
  }

  async listBadges(fedId: string, telegramUserId: bigint): Promise<string[]> {
    const rows = await this.client.ownerNetworkBadge.findMany({
      where: { fedId, telegramUserId },
      orderBy: { awardedAt: "asc" },
    });
    return rows.map((row) => row.badge);
  }

  async listMissions(
    fedId: string,
    telegramUserId: bigint,
  ): Promise<GamificationMissionRecord[]> {
    const rows = await this.client.ownerNetworkMission.findMany({
      where: { fedId, telegramUserId },
      orderBy: { kind: "asc" },
    });
    return rows.map(toMissionRecord);
  }

  async getNetworkRanking(
    fedId: string,
    limit: number,
  ): Promise<NetworkRankingEntry[]> {
    const grouped = await this.client.ownerNetworkBadge.groupBy({
      by: ["telegramUserId"],
      where: { fedId },
      _count: { badge: true },
    });

    return grouped
      .map((row) => ({
        telegramUserId: row.telegramUserId,
        badgeCount: row._count.badge,
      }))
      .sort((a, b) => b.badgeCount - a.badgeCount)
      .slice(0, limit);
  }

  async getWelcomeButtons(
    tenantId: string,
    chatId: string,
  ): Promise<WelcomeButtonsState> {
    void tenantId;
    const row = await this.client.ownerNetworkWelcomeButtons.findUnique({
      where: { chatId },
    });
    return row
      ? {
          rules: row.rules,
          otherGroups: row.otherGroups,
          support: row.support,
          verify: row.verify,
        }
      : DEFAULT_WELCOME_BUTTONS;
  }

  async setWelcomeButtons(
    tenantId: string,
    chatId: string,
    state: WelcomeButtonsState,
  ): Promise<WelcomeButtonsState> {
    const row = await this.client.ownerNetworkWelcomeButtons.upsert({
      where: { chatId },
      create: { tenantId, chatId, ...state },
      update: state,
    });
    return {
      rules: row.rules,
      otherGroups: row.otherGroups,
      support: row.support,
      verify: row.verify,
    };
  }
}

export class InMemoryGamificationRepository implements GamificationRepository {
  private readonly missions = new Map<string, GamificationMissionRecord>();
  private readonly badges = new Map<string, Set<string>>();
  private readonly badgeOrder = new Map<string, string[]>();
  private readonly badgeOwners = new Map<
    string,
    { fedId: string; telegramUserId: bigint }
  >();
  private readonly welcomeButtons = new Map<string, WelcomeButtonsState>();

  private missionKey(
    fedId: string,
    telegramUserId: bigint,
    kind: string,
  ): string {
    return `${fedId}:${telegramUserId}:${kind}`;
  }

  private badgeMapKey(fedId: string, telegramUserId: bigint): string {
    return `${fedId}:${telegramUserId}`;
  }

  async ensureMissions(
    _tenantId: string,
    fedId: string,
    telegramUserId: bigint,
  ): Promise<GamificationMissionRecord[]> {
    for (const kind of GAMIFICATION_MISSION_KINDS) {
      const key = this.missionKey(fedId, telegramUserId, kind);
      if (!this.missions.has(key)) {
        this.missions.set(key, {
          fedId,
          telegramUserId,
          kind,
          completedAt: null,
        });
      }
    }
    return this.listMissions(fedId, telegramUserId);
  }

  async completeMission(
    _tenantId: string,
    fedId: string,
    telegramUserId: bigint,
    kind: GamificationMissionKind,
  ): Promise<{ completed: boolean; alreadyDone: boolean }> {
    const key = this.missionKey(fedId, telegramUserId, kind);
    const existing = this.missions.get(key);
    if (existing?.completedAt) {
      return { completed: true, alreadyDone: true };
    }

    this.missions.set(key, {
      fedId,
      telegramUserId,
      kind,
      completedAt: new Date(),
    });
    return { completed: true, alreadyDone: false };
  }

  async awardBadge(
    _tenantId: string,
    fedId: string,
    telegramUserId: bigint,
    badge: string,
  ): Promise<{ awarded: boolean }> {
    const key = this.badgeMapKey(fedId, telegramUserId);
    const set = this.badges.get(key) ?? new Set<string>();
    if (set.has(badge)) {
      return { awarded: false };
    }
    set.add(badge);
    this.badges.set(key, set);
    this.badgeOwners.set(key, { fedId, telegramUserId });
    const order = this.badgeOrder.get(key) ?? [];
    order.push(badge);
    this.badgeOrder.set(key, order);
    return { awarded: true };
  }

  async listBadges(fedId: string, telegramUserId: bigint): Promise<string[]> {
    const key = this.badgeMapKey(fedId, telegramUserId);
    return [...(this.badgeOrder.get(key) ?? [])];
  }

  async listMissions(
    fedId: string,
    telegramUserId: bigint,
  ): Promise<GamificationMissionRecord[]> {
    return GAMIFICATION_MISSION_KINDS.map(
      (kind) =>
        this.missions.get(this.missionKey(fedId, telegramUserId, kind)) ?? {
          fedId,
          telegramUserId,
          kind,
          completedAt: null,
        },
    );
  }

  async getNetworkRanking(
    fedId: string,
    limit: number,
  ): Promise<NetworkRankingEntry[]> {
    const entries: NetworkRankingEntry[] = [];
    for (const [key, set] of this.badges.entries()) {
      const owner = this.badgeOwners.get(key);
      if (!owner || owner.fedId !== fedId) {
        continue;
      }
      entries.push({
        telegramUserId: owner.telegramUserId,
        badgeCount: set.size,
      });
    }
    return entries.sort((a, b) => b.badgeCount - a.badgeCount).slice(0, limit);
  }

  async getWelcomeButtons(
    _tenantId: string,
    chatId: string,
  ): Promise<WelcomeButtonsState> {
    return this.welcomeButtons.get(chatId) ?? DEFAULT_WELCOME_BUTTONS;
  }

  async setWelcomeButtons(
    _tenantId: string,
    chatId: string,
    state: WelcomeButtonsState,
  ): Promise<WelcomeButtonsState> {
    this.welcomeButtons.set(chatId, state);
    return state;
  }
}
