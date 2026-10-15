import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export interface D1LogState {
  readonly enabled: boolean;
  readonly logTelegramChatId: bigint;
}

export interface D1EventRecord {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly body: string | undefined;
  readonly createdAt: Date;
}

export interface QuarantineConfigState {
  readonly enabled: boolean;
  readonly strictness: string;
}

export interface CreateQuarantineItemInput {
  readonly tenantId: string;
  readonly chatId: string;
  readonly telegramChatId: bigint;
  readonly messageId: number | undefined;
  readonly actorTelegramId: bigint;
  readonly username: string | undefined;
  readonly text: string | undefined;
  readonly reason: string;
}

export interface QuarantineItemRecord {
  readonly id: string;
  readonly chatId: string;
  readonly telegramChatId: bigint;
  readonly messageId: number | undefined;
  readonly actorTelegramId: bigint;
  readonly username: string | undefined;
  readonly text: string | undefined;
  readonly reason: string;
  readonly status: string;
  readonly createdAt: Date;
}

export interface CreateAppealInput {
  readonly tenantId: string;
  readonly chatId: string | undefined;
  readonly caseRef: string;
  readonly appellantTelegramId: bigint;
  readonly username: string | undefined;
  readonly message: string;
}

export interface AppealRecord {
  readonly id: string;
  readonly chatId: string | undefined;
  readonly caseRef: string;
  readonly appellantTelegramId: bigint;
  readonly username: string | undefined;
  readonly message: string;
  readonly status: string;
  readonly createdAt: Date;
}

export interface AutomationRuleRecord {
  readonly id: string;
  readonly name: string;
  readonly triggerKind: string;
  readonly triggerValue: string;
  readonly actionKind: string;
  readonly actionValue: string | undefined;
  readonly active: boolean;
}

export interface CreateAutomationRuleInput {
  readonly tenantId: string;
  readonly chatId: string;
  readonly name: string;
  readonly triggerKind: string;
  readonly triggerValue: string;
  readonly actionKind: string;
  readonly actionValue: string | undefined;
  readonly createdBy: string | undefined;
}

export interface MissionRecord {
  readonly id: string;
  readonly title: string;
  readonly goalKind: string;
  readonly goalTarget: number;
  readonly rewardBadge: string;
  readonly active: boolean;
}

export interface CreateMissionInput {
  readonly tenantId: string;
  readonly chatId: string;
  readonly title: string;
  readonly goalKind: string;
  readonly goalTarget: number;
  readonly rewardBadge: string;
  readonly createdBy: string | undefined;
}

export interface MissionCompletion {
  readonly missionId: string;
  readonly title: string;
  readonly rewardBadge: string;
  readonly goalTarget: number;
}

export interface MissionProgressRecord {
  readonly missionId: string;
  readonly title: string;
  readonly goalTarget: number;
  readonly rewardBadge: string;
  readonly progress: number;
  readonly completedAt: Date | undefined;
}

export interface BadgeRecord {
  readonly badgeKey: string;
  readonly title: string;
  readonly awardedAt: Date;
}

export interface D1Stats {
  readonly pendingQuarantine: number;
  readonly openAppeals: number;
  readonly activeAutomations: number;
  readonly activeMissions: number;
}

export interface D1Repository {
  getLogConfig(chatId: string): Promise<D1LogState | null>;
  findAnyLogChannel(tenantId: string): Promise<bigint | undefined>;
  setLogChannel(
    tenantId: string,
    chatId: string,
    logTelegramChatId: bigint,
  ): Promise<D1LogState>;
  clearLogChannel(chatId: string): Promise<boolean>;
  recordEvent(input: {
    tenantId: string;
    chatId: string | undefined;
    kind: string;
    title: string;
    body: string | undefined;
    payload?: Record<string, unknown>;
  }): Promise<string>;
  listEvents(
    tenantId: string,
    chatId: string | undefined,
    limit?: number,
  ): Promise<D1EventRecord[]>;

  getQuarantineConfig(chatId: string): Promise<QuarantineConfigState>;
  setQuarantineConfig(
    tenantId: string,
    chatId: string,
    patch: Partial<QuarantineConfigState>,
  ): Promise<QuarantineConfigState>;
  createQuarantineItem(
    input: CreateQuarantineItemInput,
  ): Promise<QuarantineItemRecord>;
  listPendingQuarantine(
    chatId: string,
    limit?: number,
  ): Promise<QuarantineItemRecord[]>;
  resolveQuarantineItem(
    itemId: string,
    status: "approved" | "rejected",
    reviewedBy: bigint | undefined,
    note: string | undefined,
  ): Promise<QuarantineItemRecord | null>;

  createAppeal(input: CreateAppealInput): Promise<AppealRecord>;
  listOpenAppeals(
    tenantId: string,
    chatId: string | undefined,
    limit?: number,
  ): Promise<AppealRecord[]>;
  listAppeals(
    tenantId: string,
    chatId: string | undefined,
    limit?: number,
  ): Promise<AppealRecord[]>;
  resolveAppeal(
    appealId: string,
    status: "accepted" | "denied",
    resolvedBy: bigint | undefined,
    resolution: string | undefined,
  ): Promise<AppealRecord | null>;

  addAutomationRule(
    input: CreateAutomationRuleInput,
  ): Promise<AutomationRuleRecord>;
  listAutomationRules(
    chatId: string,
    activeOnly?: boolean,
  ): Promise<AutomationRuleRecord[]>;
  removeAutomationRule(chatId: string, ruleId: string): Promise<boolean>;

  createMission(input: CreateMissionInput): Promise<MissionRecord>;
  listMissions(chatId: string, activeOnly?: boolean): Promise<MissionRecord[]>;
  setMissionActive(
    chatId: string,
    missionId: string,
    active: boolean,
  ): Promise<boolean>;
  recordMissionEvent(input: {
    tenantId: string;
    chatId: string;
    telegramUserId: bigint;
    goalKind: string;
    amount: number;
  }): Promise<MissionCompletion[]>;
  listMissionProgress(
    chatId: string,
    telegramUserId: bigint,
  ): Promise<MissionProgressRecord[]>;
  listUserBadges(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
  ): Promise<BadgeRecord[]>;

  getStats(tenantId: string, chatId: string): Promise<D1Stats>;
}

const toJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const mapQuarantineItem = (item: {
  id: string;
  chatId: string;
  telegramChatId: bigint;
  messageId: number | null;
  actorTelegramId: bigint;
  username: string | null;
  text: string | null;
  reason: string;
  status: string;
  createdAt: Date;
}): QuarantineItemRecord => ({
  id: item.id,
  chatId: item.chatId,
  telegramChatId: item.telegramChatId,
  messageId: item.messageId ?? undefined,
  actorTelegramId: item.actorTelegramId,
  username: item.username ?? undefined,
  text: item.text ?? undefined,
  reason: item.reason,
  status: item.status,
  createdAt: item.createdAt,
});

const mapAppeal = (appeal: {
  id: string;
  chatId: string | null;
  caseRef: string;
  appellantTelegramId: bigint;
  username: string | null;
  message: string;
  status: string;
  createdAt: Date;
}): AppealRecord => ({
  id: appeal.id,
  chatId: appeal.chatId ?? undefined,
  caseRef: appeal.caseRef,
  appellantTelegramId: appeal.appellantTelegramId,
  username: appeal.username ?? undefined,
  message: appeal.message,
  status: appeal.status,
  createdAt: appeal.createdAt,
});

const mapAutomation = (rule: {
  id: string;
  name: string;
  triggerKind: string;
  triggerValue: string;
  actionKind: string;
  actionValue: string | null;
  active: boolean;
}): AutomationRuleRecord => ({
  id: rule.id,
  name: rule.name,
  triggerKind: rule.triggerKind,
  triggerValue: rule.triggerValue,
  actionKind: rule.actionKind,
  actionValue: rule.actionValue ?? undefined,
  active: rule.active,
});

const mapMission = (mission: {
  id: string;
  title: string;
  goalKind: string;
  goalTarget: number;
  rewardBadge: string;
  active: boolean;
}): MissionRecord => ({
  id: mission.id,
  title: mission.title,
  goalKind: mission.goalKind,
  goalTarget: mission.goalTarget,
  rewardBadge: mission.rewardBadge,
  active: mission.active,
});

export class PrismaD1Repository implements D1Repository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async getLogConfig(chatId: string): Promise<D1LogState | null> {
    const config = await this.client.d1LogConfig.findFirst({
      where: { chatId, enabled: true },
    });
    return config
      ? {
          enabled: config.enabled,
          logTelegramChatId: config.logTelegramChatId,
        }
      : null;
  }

  async findAnyLogChannel(tenantId: string): Promise<bigint | undefined> {
    const config = await this.client.d1LogConfig.findFirst({
      where: { tenantId, enabled: true },
      orderBy: { updatedAt: "desc" },
    });
    return config?.logTelegramChatId;
  }

  async setLogChannel(
    tenantId: string,
    chatId: string,
    logTelegramChatId: bigint,
  ): Promise<D1LogState> {
    const config = await this.client.d1LogConfig.upsert({
      where: { tenantId_chatId: { tenantId, chatId } },
      create: { tenantId, chatId, logTelegramChatId },
      update: { logTelegramChatId, enabled: true },
    });
    return {
      enabled: config.enabled,
      logTelegramChatId: config.logTelegramChatId,
    };
  }

  async clearLogChannel(chatId: string): Promise<boolean> {
    const result = await this.client.d1LogConfig.updateMany({
      where: { chatId, enabled: true },
      data: { enabled: false },
    });
    return result.count > 0;
  }

  async recordEvent(input: {
    tenantId: string;
    chatId: string | undefined;
    kind: string;
    title: string;
    body: string | undefined;
    payload?: Record<string, unknown>;
  }): Promise<string> {
    const event = await this.client.d1Event.create({
      data: {
        tenantId: input.tenantId,
        kind: input.kind,
        title: input.title,
        ...(input.chatId ? { chatId: input.chatId } : {}),
        ...(input.body ? { body: input.body } : {}),
        ...(input.payload ? { payload: toJson(input.payload) } : {}),
      },
    });
    return event.id;
  }

  async listEvents(
    tenantId: string,
    chatId: string | undefined,
    limit = 10,
  ): Promise<D1EventRecord[]> {
    const events = await this.client.d1Event.findMany({
      where: { tenantId, ...(chatId ? { chatId } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return events.map((event) => ({
      id: event.id,
      kind: event.kind,
      title: event.title,
      body: event.body ?? undefined,
      createdAt: event.createdAt,
    }));
  }

  async getQuarantineConfig(chatId: string): Promise<QuarantineConfigState> {
    const config = await this.client.quarantineConfig.findUnique({
      where: { chatId },
    });
    return {
      enabled: config?.enabled ?? false,
      strictness: config?.strictness ?? "balanced",
    };
  }

  async setQuarantineConfig(
    tenantId: string,
    chatId: string,
    patch: Partial<QuarantineConfigState>,
  ): Promise<QuarantineConfigState> {
    const config = await this.client.quarantineConfig.upsert({
      where: { chatId },
      create: {
        tenantId,
        chatId,
        enabled: patch.enabled ?? false,
        strictness: patch.strictness ?? "balanced",
      },
      update: {
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
        ...(patch.strictness !== undefined
          ? { strictness: patch.strictness }
          : {}),
      },
    });
    return { enabled: config.enabled, strictness: config.strictness };
  }

  async createQuarantineItem(
    input: CreateQuarantineItemInput,
  ): Promise<QuarantineItemRecord> {
    const item = await this.client.quarantineItem.create({
      data: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        telegramChatId: input.telegramChatId,
        actorTelegramId: input.actorTelegramId,
        reason: input.reason,
        ...(input.messageId !== undefined
          ? { messageId: input.messageId }
          : {}),
        ...(input.username ? { username: input.username } : {}),
        ...(input.text ? { text: input.text } : {}),
      },
    });
    return mapQuarantineItem(item);
  }

  async listPendingQuarantine(
    chatId: string,
    limit = 10,
  ): Promise<QuarantineItemRecord[]> {
    const items = await this.client.quarantineItem.findMany({
      where: { chatId, status: "pending" },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    return items.map(mapQuarantineItem);
  }

  async resolveQuarantineItem(
    itemId: string,
    status: "approved" | "rejected",
    reviewedBy: bigint | undefined,
    note: string | undefined,
  ): Promise<QuarantineItemRecord | null> {
    const result = await this.client.quarantineItem.updateMany({
      where: { id: itemId, status: "pending" },
      data: {
        status,
        reviewedAt: new Date(),
        ...(reviewedBy !== undefined ? { reviewedBy } : {}),
        ...(note ? { reviewNote: note } : {}),
      },
    });
    if (result.count === 0) {
      return null;
    }
    const item = await this.client.quarantineItem.findUnique({
      where: { id: itemId },
    });
    return item ? mapQuarantineItem(item) : null;
  }

  async createAppeal(input: CreateAppealInput): Promise<AppealRecord> {
    const appeal = await this.client.d1Appeal.create({
      data: {
        tenantId: input.tenantId,
        caseRef: input.caseRef,
        appellantTelegramId: input.appellantTelegramId,
        message: input.message,
        ...(input.chatId ? { chatId: input.chatId } : {}),
        ...(input.username ? { username: input.username } : {}),
      },
    });
    return mapAppeal(appeal);
  }

  async listOpenAppeals(
    tenantId: string,
    chatId: string | undefined,
    limit = 10,
  ): Promise<AppealRecord[]> {
    const appeals = await this.client.d1Appeal.findMany({
      where: {
        tenantId,
        status: "open",
        ...(chatId ? { OR: [{ chatId }, { chatId: null }] } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    return appeals.map(mapAppeal);
  }

  async listAppeals(
    tenantId: string,
    chatId: string | undefined,
    limit = 50,
  ): Promise<AppealRecord[]> {
    const appeals = await this.client.d1Appeal.findMany({
      where: {
        tenantId,
        ...(chatId ? { OR: [{ chatId }, { chatId: null }] } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return appeals.map(mapAppeal);
  }

  async resolveAppeal(
    appealId: string,
    status: "accepted" | "denied",
    resolvedBy: bigint | undefined,
    resolution: string | undefined,
  ): Promise<AppealRecord | null> {
    const result = await this.client.d1Appeal.updateMany({
      where: { id: appealId, status: "open" },
      data: {
        status,
        resolvedAt: new Date(),
        ...(resolvedBy !== undefined ? { resolvedBy } : {}),
        ...(resolution ? { resolution } : {}),
      },
    });
    if (result.count === 0) {
      return null;
    }
    const appeal = await this.client.d1Appeal.findUnique({
      where: { id: appealId },
    });
    return appeal ? mapAppeal(appeal) : null;
  }

  async addAutomationRule(
    input: CreateAutomationRuleInput,
  ): Promise<AutomationRuleRecord> {
    const rule = await this.client.automationRule.create({
      data: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        name: input.name,
        triggerKind: input.triggerKind,
        triggerValue: input.triggerValue,
        actionKind: input.actionKind,
        ...(input.actionValue ? { actionValue: input.actionValue } : {}),
        ...(input.createdBy ? { createdBy: input.createdBy } : {}),
      },
    });
    return mapAutomation(rule);
  }

  async listAutomationRules(
    chatId: string,
    activeOnly = false,
  ): Promise<AutomationRuleRecord[]> {
    const rules = await this.client.automationRule.findMany({
      where: { chatId, ...(activeOnly ? { active: true } : {}) },
      orderBy: { createdAt: "asc" },
    });
    return rules.map(mapAutomation);
  }

  async removeAutomationRule(chatId: string, ruleId: string): Promise<boolean> {
    const result = await this.client.automationRule.updateMany({
      where: { chatId, id: ruleId, active: true },
      data: { active: false },
    });
    return result.count > 0;
  }

  async createMission(input: CreateMissionInput): Promise<MissionRecord> {
    const mission = await this.client.mission.create({
      data: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        title: input.title,
        goalKind: input.goalKind,
        goalTarget: input.goalTarget,
        rewardBadge: input.rewardBadge,
        ...(input.createdBy ? { createdBy: input.createdBy } : {}),
      },
    });
    return mapMission(mission);
  }

  async listMissions(
    chatId: string,
    activeOnly = false,
  ): Promise<MissionRecord[]> {
    const missions = await this.client.mission.findMany({
      where: { chatId, ...(activeOnly ? { active: true } : {}) },
      orderBy: { createdAt: "asc" },
    });
    return missions.map(mapMission);
  }

  async setMissionActive(
    chatId: string,
    missionId: string,
    active: boolean,
  ): Promise<boolean> {
    const result = await this.client.mission.updateMany({
      where: { chatId, id: missionId },
      data: { active },
    });
    return result.count > 0;
  }

  async recordMissionEvent(input: {
    tenantId: string;
    chatId: string;
    telegramUserId: bigint;
    goalKind: string;
    amount: number;
  }): Promise<MissionCompletion[]> {
    const missions = await this.client.mission.findMany({
      where: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        active: true,
        goalKind: input.goalKind,
      },
    });
    const completions: MissionCompletion[] = [];
    for (const mission of missions) {
      const existing = await this.client.missionProgress.findUnique({
        where: {
          missionId_telegramUserId: {
            missionId: mission.id,
            telegramUserId: input.telegramUserId,
          },
        },
      });
      if (existing?.completedAt) {
        continue;
      }
      const progress = Math.min(
        mission.goalTarget,
        (existing?.progress ?? 0) + input.amount,
      );
      const completedAt =
        progress >= mission.goalTarget ? new Date() : undefined;
      await this.client.missionProgress.upsert({
        where: {
          missionId_telegramUserId: {
            missionId: mission.id,
            telegramUserId: input.telegramUserId,
          },
        },
        create: {
          missionId: mission.id,
          telegramUserId: input.telegramUserId,
          progress,
          ...(completedAt ? { completedAt } : {}),
        },
        update: {
          progress,
          ...(completedAt ? { completedAt } : {}),
        },
      });
      if (completedAt) {
        await this.client.userBadge.upsert({
          where: {
            tenantId_chatId_telegramUserId_badgeKey: {
              tenantId: input.tenantId,
              chatId: input.chatId,
              telegramUserId: input.telegramUserId,
              badgeKey: mission.rewardBadge,
            },
          },
          create: {
            tenantId: input.tenantId,
            chatId: input.chatId,
            telegramUserId: input.telegramUserId,
            badgeKey: mission.rewardBadge,
            title: mission.title,
          },
          update: {},
        });
        completions.push({
          missionId: mission.id,
          title: mission.title,
          rewardBadge: mission.rewardBadge,
          goalTarget: mission.goalTarget,
        });
      }
    }
    return completions;
  }

  async listMissionProgress(
    chatId: string,
    telegramUserId: bigint,
  ): Promise<MissionProgressRecord[]> {
    const rows = await this.client.missionProgress.findMany({
      where: { telegramUserId, mission: { chatId } },
      include: { mission: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
    return rows.map((row) => ({
      missionId: row.missionId,
      title: row.mission.title,
      goalTarget: row.mission.goalTarget,
      rewardBadge: row.mission.rewardBadge,
      progress: row.progress,
      completedAt: row.completedAt ?? undefined,
    }));
  }

  async listUserBadges(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
  ): Promise<BadgeRecord[]> {
    const badges = await this.client.userBadge.findMany({
      where: { tenantId, chatId, telegramUserId },
      orderBy: { awardedAt: "desc" },
    });
    return badges.map((badge) => ({
      badgeKey: badge.badgeKey,
      title: badge.title,
      awardedAt: badge.awardedAt,
    }));
  }

  async getStats(tenantId: string, chatId: string): Promise<D1Stats> {
    const [pendingQuarantine, openAppeals, activeAutomations, activeMissions] =
      await Promise.all([
        this.client.quarantineItem.count({
          where: { tenantId, chatId, status: "pending" },
        }),
        this.client.d1Appeal.count({
          where: {
            tenantId,
            status: "open",
            OR: [{ chatId }, { chatId: null }],
          },
        }),
        this.client.automationRule.count({
          where: { tenantId, chatId, active: true },
        }),
        this.client.mission.count({
          where: { tenantId, chatId, active: true },
        }),
      ]);
    return {
      pendingQuarantine,
      openAppeals,
      activeAutomations,
      activeMissions,
    };
  }
}

export class InMemoryD1Repository implements D1Repository {
  private readonly logConfigs = new Map<string, D1LogState>();
  private readonly quarantineConfigs = new Map<string, QuarantineConfigState>();
  private readonly quarantineItems = new Map<string, QuarantineItemRecord>();
  private readonly appeals = new Map<string, AppealRecord>();
  private readonly events: (D1EventRecord & {
    tenantId: string;
    chatId: string | undefined;
  })[] = [];
  private readonly automations = new Map<
    string,
    AutomationRuleRecord & { chatId: string }
  >();
  private readonly missions = new Map<
    string,
    MissionRecord & { tenantId: string; chatId: string }
  >();
  private readonly progress = new Map<
    string,
    MissionProgressRecord & { telegramUserId: bigint }
  >();
  private readonly badges: (BadgeRecord & {
    tenantId: string;
    chatId: string;
    telegramUserId: bigint;
  })[] = [];

  async getLogConfig(chatId: string): Promise<D1LogState | null> {
    const config = this.logConfigs.get(chatId);
    return config?.enabled ? config : null;
  }

  async findAnyLogChannel(_tenantId: string): Promise<bigint | undefined> {
    return [...this.logConfigs.values()].find((config) => config.enabled)
      ?.logTelegramChatId;
  }

  async setLogChannel(
    _tenantId: string,
    chatId: string,
    logTelegramChatId: bigint,
  ): Promise<D1LogState> {
    const config = { enabled: true, logTelegramChatId };
    this.logConfigs.set(chatId, config);
    return config;
  }

  async clearLogChannel(chatId: string): Promise<boolean> {
    const existing = this.logConfigs.get(chatId);
    if (!existing?.enabled) {
      return false;
    }
    this.logConfigs.set(chatId, { ...existing, enabled: false });
    return true;
  }

  async recordEvent(input: {
    tenantId: string;
    chatId: string | undefined;
    kind: string;
    title: string;
    body: string | undefined;
  }): Promise<string> {
    const id = `event_${this.events.length + 1}`;
    this.events.push({
      id,
      kind: input.kind,
      title: input.title,
      body: input.body,
      createdAt: new Date(),
      tenantId: input.tenantId,
      chatId: input.chatId,
    });
    return id;
  }

  async listEvents(
    tenantId: string,
    chatId: string | undefined,
    limit = 10,
  ): Promise<D1EventRecord[]> {
    return this.events
      .filter(
        (event) =>
          event.tenantId === tenantId && (!chatId || event.chatId === chatId),
      )
      .slice(-limit)
      .reverse()
      .map(({ tenantId: _tenantId, chatId: _chatId, ...event }) => event);
  }

  async getQuarantineConfig(chatId: string): Promise<QuarantineConfigState> {
    return (
      this.quarantineConfigs.get(chatId) ?? {
        enabled: false,
        strictness: "balanced",
      }
    );
  }

  async setQuarantineConfig(
    _tenantId: string,
    chatId: string,
    patch: Partial<QuarantineConfigState>,
  ): Promise<QuarantineConfigState> {
    const next = {
      ...(await this.getQuarantineConfig(chatId)),
      ...patch,
    };
    this.quarantineConfigs.set(chatId, next);
    return next;
  }

  async createQuarantineItem(
    input: CreateQuarantineItemInput,
  ): Promise<QuarantineItemRecord> {
    const item: QuarantineItemRecord = {
      id: `q_${this.quarantineItems.size + 1}`,
      chatId: input.chatId,
      telegramChatId: input.telegramChatId,
      messageId: input.messageId,
      actorTelegramId: input.actorTelegramId,
      username: input.username,
      text: input.text,
      reason: input.reason,
      status: "pending",
      createdAt: new Date(),
    };
    this.quarantineItems.set(item.id, item);
    return item;
  }

  async listPendingQuarantine(
    chatId: string,
    limit = 10,
  ): Promise<QuarantineItemRecord[]> {
    return [...this.quarantineItems.values()]
      .filter((item) => item.chatId === chatId && item.status === "pending")
      .slice(0, limit);
  }

  async resolveQuarantineItem(
    itemId: string,
    status: "approved" | "rejected",
  ): Promise<QuarantineItemRecord | null> {
    const item = this.quarantineItems.get(itemId);
    if (item?.status !== "pending") {
      return null;
    }
    const next = { ...item, status };
    this.quarantineItems.set(itemId, next);
    return next;
  }

  async createAppeal(input: CreateAppealInput): Promise<AppealRecord> {
    const appeal: AppealRecord = {
      id: `appeal_${this.appeals.size + 1}`,
      chatId: input.chatId,
      caseRef: input.caseRef,
      appellantTelegramId: input.appellantTelegramId,
      username: input.username,
      message: input.message,
      status: "open",
      createdAt: new Date(),
    };
    this.appeals.set(appeal.id, appeal);
    return appeal;
  }

  async listOpenAppeals(
    tenantId: string,
    chatId: string | undefined,
    limit = 10,
  ): Promise<AppealRecord[]> {
    void tenantId;
    return [...this.appeals.values()]
      .filter(
        (appeal) =>
          appeal.status === "open" &&
          (!chatId || !appeal.chatId || appeal.chatId === chatId),
      )
      .slice(0, limit);
  }

  async listAppeals(
    tenantId: string,
    chatId: string | undefined,
    limit = 50,
  ): Promise<AppealRecord[]> {
    void tenantId;
    return [...this.appeals.values()]
      .filter((appeal) => !chatId || !appeal.chatId || appeal.chatId === chatId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async resolveAppeal(
    appealId: string,
    status: "accepted" | "denied",
  ): Promise<AppealRecord | null> {
    const appeal = this.appeals.get(appealId);
    if (appeal?.status !== "open") {
      return null;
    }
    const next = { ...appeal, status };
    this.appeals.set(appealId, next);
    return next;
  }

  async addAutomationRule(
    input: CreateAutomationRuleInput,
  ): Promise<AutomationRuleRecord> {
    const rule = {
      id: `auto_${this.automations.size + 1}`,
      name: input.name,
      triggerKind: input.triggerKind,
      triggerValue: input.triggerValue,
      actionKind: input.actionKind,
      actionValue: input.actionValue,
      active: true,
      chatId: input.chatId,
    };
    this.automations.set(rule.id, rule);
    return rule;
  }

  async listAutomationRules(
    chatId: string,
    activeOnly = false,
  ): Promise<AutomationRuleRecord[]> {
    return [...this.automations.values()].filter(
      (rule) => rule.chatId === chatId && (!activeOnly || rule.active),
    );
  }

  async removeAutomationRule(chatId: string, ruleId: string): Promise<boolean> {
    const rule = this.automations.get(ruleId);
    if (!rule || rule.chatId !== chatId || !rule.active) {
      return false;
    }
    this.automations.set(ruleId, { ...rule, active: false });
    return true;
  }

  async createMission(input: CreateMissionInput): Promise<MissionRecord> {
    const mission = {
      id: `mission_${this.missions.size + 1}`,
      title: input.title,
      goalKind: input.goalKind,
      goalTarget: input.goalTarget,
      rewardBadge: input.rewardBadge,
      active: true,
      tenantId: input.tenantId,
      chatId: input.chatId,
    };
    this.missions.set(mission.id, mission);
    return mission;
  }

  async listMissions(
    chatId: string,
    activeOnly = false,
  ): Promise<MissionRecord[]> {
    return [...this.missions.values()].filter(
      (mission) => mission.chatId === chatId && (!activeOnly || mission.active),
    );
  }

  async setMissionActive(
    chatId: string,
    missionId: string,
    active: boolean,
  ): Promise<boolean> {
    const mission = this.missions.get(missionId);
    if (!mission || mission.chatId !== chatId) {
      return false;
    }
    this.missions.set(missionId, { ...mission, active });
    return true;
  }

  async recordMissionEvent(input: {
    tenantId: string;
    chatId: string;
    telegramUserId: bigint;
    goalKind: string;
    amount: number;
  }): Promise<MissionCompletion[]> {
    const completions: MissionCompletion[] = [];
    for (const mission of this.missions.values()) {
      if (
        mission.tenantId !== input.tenantId ||
        mission.chatId !== input.chatId ||
        !mission.active ||
        mission.goalKind !== input.goalKind
      ) {
        continue;
      }
      const key = `${mission.id}:${input.telegramUserId.toString()}`;
      const existing = this.progress.get(key);
      if (existing?.completedAt) {
        continue;
      }
      const progress = Math.min(
        mission.goalTarget,
        (existing?.progress ?? 0) + input.amount,
      );
      const completedAt =
        progress >= mission.goalTarget ? new Date() : undefined;
      this.progress.set(key, {
        missionId: mission.id,
        title: mission.title,
        goalTarget: mission.goalTarget,
        rewardBadge: mission.rewardBadge,
        progress,
        completedAt,
        telegramUserId: input.telegramUserId,
      });
      if (completedAt) {
        this.badges.push({
          badgeKey: mission.rewardBadge,
          title: mission.title,
          awardedAt: completedAt,
          tenantId: input.tenantId,
          chatId: input.chatId,
          telegramUserId: input.telegramUserId,
        });
        completions.push({
          missionId: mission.id,
          title: mission.title,
          rewardBadge: mission.rewardBadge,
          goalTarget: mission.goalTarget,
        });
      }
    }
    return completions;
  }

  async listMissionProgress(
    chatId: string,
    telegramUserId: bigint,
  ): Promise<MissionProgressRecord[]> {
    return [...this.progress.values()].filter((row) => {
      const mission = this.missions.get(row.missionId);
      return (
        mission?.chatId === chatId && row.telegramUserId === telegramUserId
      );
    });
  }

  async listUserBadges(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
  ): Promise<BadgeRecord[]> {
    return this.badges.filter(
      (badge) =>
        badge.tenantId === tenantId &&
        badge.chatId === chatId &&
        badge.telegramUserId === telegramUserId,
    );
  }

  async getStats(tenantId: string, chatId: string): Promise<D1Stats> {
    const pendingQuarantine = [...this.quarantineItems.values()].filter(
      (item) => item.chatId === chatId && item.status === "pending",
    ).length;
    const openAppeals = [...this.appeals.values()].filter(
      (appeal) =>
        appeal.status === "open" &&
        (!appeal.chatId || appeal.chatId === chatId),
    ).length;
    const activeAutomations = [...this.automations.values()].filter(
      (rule) => rule.chatId === chatId && rule.active,
    ).length;
    const activeMissions = [...this.missions.values()].filter(
      (mission) =>
        mission.tenantId === tenantId &&
        mission.chatId === chatId &&
        mission.active,
    ).length;
    return {
      pendingQuarantine,
      openAppeals,
      activeAutomations,
      activeMissions,
    };
  }
}
