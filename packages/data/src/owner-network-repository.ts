import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export type OwnerNetworkTextMode = "per_group" | "global";
export type OwnerNetworkMembershipMode = "off" | "require_all";
export const OWNER_NETWORK_GROUP_ROLES = [
  "staff",
  "logs",
  "support",
  "announcements",
  "archive",
] as const;
export type OwnerNetworkGroupRole = (typeof OWNER_NETWORK_GROUP_ROLES)[number];

export const OWNER_NETWORK_ROUTE_EVENT_KINDS = [
  "logs",
  "reports",
  "quarantine",
  "appeals",
  "tickets",
  "raid_alerts",
  "spam_alerts",
  "moderation_actions",
] as const;
export type OwnerNetworkRouteEventKind =
  (typeof OWNER_NETWORK_ROUTE_EVENT_KINDS)[number];

export const OWNER_NETWORK_ROUTE_SOURCE_ALL = "*";

export interface OwnerNetworkConfigRecord {
  readonly tenantId: string;
  readonly fedId: string;
  readonly logTelegramChatId: bigint | null;
  readonly welcomeMode: OwnerNetworkTextMode;
  readonly welcomeText: string | null;
  readonly goodbyeText: string | null;
  readonly rulesMode: OwnerNetworkTextMode;
  readonly rulesText: string | null;
  readonly membershipMode: OwnerNetworkMembershipMode;
}

export interface OwnerNetworkConfigPatch {
  readonly logTelegramChatId?: bigint | null;
  readonly welcomeMode?: OwnerNetworkTextMode;
  readonly welcomeText?: string | null;
  readonly goodbyeText?: string | null;
  readonly rulesMode?: OwnerNetworkTextMode;
  readonly rulesText?: string | null;
  readonly membershipMode?: OwnerNetworkMembershipMode;
}

export interface OwnerNetworkGroupRoleRecord {
  readonly tenantId: string;
  readonly fedId: string;
  readonly chatId: string;
  readonly role: OwnerNetworkGroupRole;
  readonly label: string | undefined;
}

export interface OwnerNetworkGroupRoleInput {
  readonly chatId: string;
  readonly role: OwnerNetworkGroupRole;
  readonly label?: string | null;
}

export interface OwnerNetworkRouteRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly fedId: string;
  readonly sourceChatId: string | undefined;
  readonly sourceKey: string;
  readonly eventKind: OwnerNetworkRouteEventKind;
  readonly targetChatId: string;
  readonly enabled: boolean;
}

export interface OwnerNetworkRouteInput {
  readonly sourceChatId?: string | null;
  readonly eventKind: OwnerNetworkRouteEventKind;
  readonly targetChatId: string;
  readonly enabled?: boolean;
}

export interface OwnerNetworkResolvedRoute {
  readonly fedId: string;
  readonly sourceChatId: string;
  readonly eventKind: OwnerNetworkRouteEventKind;
  readonly targetChatId: string;
  readonly targetTelegramChatId: bigint;
}

export interface OwnerNetworkSnapshotRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly fedId: string;
  readonly createdBy: string;
  readonly reason: string;
  readonly payload: unknown;
  readonly createdAt: Date;
}

export interface OwnerNetworkRepository {
  getConfig(tenantId: string, fedId: string): Promise<OwnerNetworkConfigRecord>;
  upsertConfig(
    tenantId: string,
    fedId: string,
    patch: OwnerNetworkConfigPatch,
  ): Promise<OwnerNetworkConfigRecord>;
  listGroupRoles(fedId: string): Promise<OwnerNetworkGroupRoleRecord[]>;
  replaceGroupRoles(
    tenantId: string,
    fedId: string,
    roles: readonly OwnerNetworkGroupRoleInput[],
  ): Promise<OwnerNetworkGroupRoleRecord[]>;
  listRoutes(fedId: string): Promise<OwnerNetworkRouteRecord[]>;
  replaceRoutes(
    tenantId: string,
    fedId: string,
    routes: readonly OwnerNetworkRouteInput[],
  ): Promise<OwnerNetworkRouteRecord[]>;
  resolveRoute(
    sourceChatId: string,
    eventKind: OwnerNetworkRouteEventKind,
  ): Promise<OwnerNetworkResolvedRoute | null>;
  createSnapshot(
    tenantId: string,
    fedId: string,
    createdBy: string,
    reason: string,
    payload: unknown,
  ): Promise<OwnerNetworkSnapshotRecord>;
  listSnapshots(
    fedId: string,
    limit?: number,
  ): Promise<OwnerNetworkSnapshotRecord[]>;
  getLatestSnapshot(fedId: string): Promise<OwnerNetworkSnapshotRecord | null>;
}

const DEFAULT_CONFIG = {
  logTelegramChatId: null,
  welcomeMode: "per_group" as const,
  welcomeText: null,
  goodbyeText: null,
  rulesMode: "per_group" as const,
  rulesText: null,
  membershipMode: "off" as const,
};

export class PrismaOwnerNetworkRepository implements OwnerNetworkRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async getConfig(
    tenantId: string,
    fedId: string,
  ): Promise<OwnerNetworkConfigRecord> {
    const config = await this.client.ownerNetworkConfig.findUnique({
      where: { fedId },
    });
    return config
      ? toRecord(config)
      : {
          tenantId,
          fedId,
          ...DEFAULT_CONFIG,
        };
  }

  async upsertConfig(
    tenantId: string,
    fedId: string,
    patch: OwnerNetworkConfigPatch,
  ): Promise<OwnerNetworkConfigRecord> {
    const data = {
      ...(patch.logTelegramChatId !== undefined
        ? { logTelegramChatId: patch.logTelegramChatId }
        : {}),
      ...(patch.welcomeMode !== undefined
        ? { welcomeMode: patch.welcomeMode }
        : {}),
      ...(patch.welcomeText !== undefined
        ? { welcomeText: patch.welcomeText }
        : {}),
      ...(patch.goodbyeText !== undefined
        ? { goodbyeText: patch.goodbyeText }
        : {}),
      ...(patch.rulesMode !== undefined ? { rulesMode: patch.rulesMode } : {}),
      ...(patch.rulesText !== undefined ? { rulesText: patch.rulesText } : {}),
      ...(patch.membershipMode !== undefined
        ? { membershipMode: patch.membershipMode }
        : {}),
    };

    const config = await this.client.ownerNetworkConfig.upsert({
      where: { fedId },
      create: {
        tenantId,
        fedId,
        ...data,
      },
      update: data,
    });
    return toRecord(config);
  }

  async listGroupRoles(fedId: string): Promise<OwnerNetworkGroupRoleRecord[]> {
    const rows = await this.client.ownerNetworkGroupRole.findMany({
      where: { fedId },
      orderBy: [{ chatId: "asc" }, { role: "asc" }],
    });
    return rows.map(toGroupRoleRecord);
  }

  async replaceGroupRoles(
    tenantId: string,
    fedId: string,
    roles: readonly OwnerNetworkGroupRoleInput[],
  ): Promise<OwnerNetworkGroupRoleRecord[]> {
    await this.client.$transaction(async (tx) => {
      await tx.ownerNetworkGroupRole.deleteMany({ where: { fedId } });
      if (roles.length > 0) {
        await tx.ownerNetworkGroupRole.createMany({
          data: roles.map((role) => ({
            tenantId,
            fedId,
            chatId: role.chatId,
            role: role.role,
            label: normalizeOptionalLabel(role.label),
          })),
          skipDuplicates: true,
        });
      }
    });
    return this.listGroupRoles(fedId);
  }

  async listRoutes(fedId: string): Promise<OwnerNetworkRouteRecord[]> {
    const rows = await this.client.ownerNetworkRoute.findMany({
      where: { fedId },
      orderBy: [{ sourceKey: "asc" }, { eventKind: "asc" }],
    });
    return rows.map(toRouteRecord);
  }

  async replaceRoutes(
    tenantId: string,
    fedId: string,
    routes: readonly OwnerNetworkRouteInput[],
  ): Promise<OwnerNetworkRouteRecord[]> {
    await this.client.$transaction(async (tx) => {
      await tx.ownerNetworkRoute.deleteMany({ where: { fedId } });
      if (routes.length > 0) {
        await tx.ownerNetworkRoute.createMany({
          data: routes.map((route) => {
            const sourceChatId = route.sourceChatId ?? null;
            return {
              tenantId,
              fedId,
              sourceChatId,
              sourceKey: sourceChatId ?? OWNER_NETWORK_ROUTE_SOURCE_ALL,
              eventKind: route.eventKind,
              targetChatId: route.targetChatId,
              enabled: route.enabled ?? true,
            };
          }),
          skipDuplicates: true,
        });
      }
    });
    return this.listRoutes(fedId);
  }

  async resolveRoute(
    sourceChatId: string,
    eventKind: OwnerNetworkRouteEventKind,
  ): Promise<OwnerNetworkResolvedRoute | null> {
    const source = await this.client.federationChat.findUnique({
      where: { chatId: sourceChatId },
    });
    if (!source) {
      return null;
    }

    const route =
      (await this.client.ownerNetworkRoute.findUnique({
        where: {
          fedId_sourceKey_eventKind: {
            fedId: source.fedId,
            sourceKey: sourceChatId,
            eventKind,
          },
        },
      })) ??
      (await this.client.ownerNetworkRoute.findUnique({
        where: {
          fedId_sourceKey_eventKind: {
            fedId: source.fedId,
            sourceKey: OWNER_NETWORK_ROUTE_SOURCE_ALL,
            eventKind,
          },
        },
      }));

    if (!route?.enabled) {
      return null;
    }

    const target = await this.client.federationChat.findUnique({
      where: { chatId: route.targetChatId },
    });
    if (!target || target.fedId !== source.fedId) {
      return null;
    }

    return {
      fedId: source.fedId,
      sourceChatId,
      eventKind,
      targetChatId: target.chatId,
      targetTelegramChatId: target.telegramChatId,
    };
  }

  async createSnapshot(
    tenantId: string,
    fedId: string,
    createdBy: string,
    reason: string,
    payload: unknown,
  ): Promise<OwnerNetworkSnapshotRecord> {
    const row = await this.client.ownerNetworkConfigSnapshot.create({
      data: {
        tenantId,
        fedId,
        createdBy,
        reason,
        payload: payload as Prisma.InputJsonValue,
      },
    });
    return row;
  }

  async listSnapshots(
    fedId: string,
    limit = 10,
  ): Promise<OwnerNetworkSnapshotRecord[]> {
    return this.client.ownerNetworkConfigSnapshot.findMany({
      where: { fedId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async getLatestSnapshot(
    fedId: string,
  ): Promise<OwnerNetworkSnapshotRecord | null> {
    return this.client.ownerNetworkConfigSnapshot.findFirst({
      where: { fedId },
      orderBy: { createdAt: "desc" },
    });
  }
}

export class InMemoryOwnerNetworkRepository implements OwnerNetworkRepository {
  private readonly configs = new Map<string, OwnerNetworkConfigRecord>();
  private readonly roles = new Map<string, OwnerNetworkGroupRoleRecord[]>();
  private readonly routes = new Map<string, OwnerNetworkRouteRecord[]>();
  private readonly snapshots = new Map<string, OwnerNetworkSnapshotRecord[]>();
  private snapshotSeq = 0;

  async getConfig(
    tenantId: string,
    fedId: string,
  ): Promise<OwnerNetworkConfigRecord> {
    return (
      this.configs.get(fedId) ?? {
        tenantId,
        fedId,
        ...DEFAULT_CONFIG,
      }
    );
  }

  async upsertConfig(
    tenantId: string,
    fedId: string,
    patch: OwnerNetworkConfigPatch,
  ): Promise<OwnerNetworkConfigRecord> {
    const current = await this.getConfig(tenantId, fedId);
    const next: OwnerNetworkConfigRecord = { ...current, ...patch };
    this.configs.set(fedId, next);
    return next;
  }

  async listGroupRoles(fedId: string): Promise<OwnerNetworkGroupRoleRecord[]> {
    return this.roles.get(fedId) ?? [];
  }

  async replaceGroupRoles(
    tenantId: string,
    fedId: string,
    roles: readonly OwnerNetworkGroupRoleInput[],
  ): Promise<OwnerNetworkGroupRoleRecord[]> {
    const next = roles.map((role) => ({
      tenantId,
      fedId,
      chatId: role.chatId,
      role: role.role,
      label: normalizeOptionalLabel(role.label) ?? undefined,
    }));
    this.roles.set(fedId, next);
    return next;
  }

  async listRoutes(fedId: string): Promise<OwnerNetworkRouteRecord[]> {
    return this.routes.get(fedId) ?? [];
  }

  async replaceRoutes(
    tenantId: string,
    fedId: string,
    routes: readonly OwnerNetworkRouteInput[],
  ): Promise<OwnerNetworkRouteRecord[]> {
    const next = routes.map((route, index) => {
      const sourceChatId = route.sourceChatId ?? undefined;
      return {
        id: `route_${index + 1}`,
        tenantId,
        fedId,
        sourceChatId,
        sourceKey: sourceChatId ?? OWNER_NETWORK_ROUTE_SOURCE_ALL,
        eventKind: route.eventKind,
        targetChatId: route.targetChatId,
        enabled: route.enabled ?? true,
      };
    });
    this.routes.set(fedId, next);
    return next;
  }

  async resolveRoute(): Promise<OwnerNetworkResolvedRoute | null> {
    return null;
  }

  async createSnapshot(
    tenantId: string,
    fedId: string,
    createdBy: string,
    reason: string,
    payload: unknown,
  ): Promise<OwnerNetworkSnapshotRecord> {
    this.snapshotSeq += 1;
    const record: OwnerNetworkSnapshotRecord = {
      id: `snap_${this.snapshotSeq}`,
      tenantId,
      fedId,
      createdBy,
      reason,
      payload,
      createdAt: new Date(),
    };
    const list = this.snapshots.get(fedId) ?? [];
    list.unshift(record);
    this.snapshots.set(fedId, list);
    return record;
  }

  async listSnapshots(
    fedId: string,
    limit = 10,
  ): Promise<OwnerNetworkSnapshotRecord[]> {
    return (this.snapshots.get(fedId) ?? []).slice(0, limit);
  }

  async getLatestSnapshot(
    fedId: string,
  ): Promise<OwnerNetworkSnapshotRecord | null> {
    return (this.snapshots.get(fedId) ?? [])[0] ?? null;
  }
}

const asTextMode = (value: string): OwnerNetworkTextMode =>
  value === "global" ? "global" : "per_group";

const asMembershipMode = (value: string): OwnerNetworkMembershipMode =>
  value === "require_all" ? "require_all" : "off";

const toRecord = (config: {
  tenantId: string;
  fedId: string;
  logTelegramChatId: bigint | null;
  welcomeMode: string;
  welcomeText: string | null;
  goodbyeText: string | null;
  rulesMode: string;
  rulesText: string | null;
  membershipMode: string;
}): OwnerNetworkConfigRecord => ({
  tenantId: config.tenantId,
  fedId: config.fedId,
  logTelegramChatId: config.logTelegramChatId,
  welcomeMode: asTextMode(config.welcomeMode),
  welcomeText: config.welcomeText,
  goodbyeText: config.goodbyeText,
  rulesMode: asTextMode(config.rulesMode),
  rulesText: config.rulesText,
  membershipMode: asMembershipMode(config.membershipMode),
});

const isGroupRole = (value: string): value is OwnerNetworkGroupRole =>
  OWNER_NETWORK_GROUP_ROLES.some((role) => role === value);

const asGroupRole = (value: string): OwnerNetworkGroupRole =>
  isGroupRole(value) ? value : "staff";

const isRouteEventKind = (value: string): value is OwnerNetworkRouteEventKind =>
  OWNER_NETWORK_ROUTE_EVENT_KINDS.some((kind) => kind === value);

const asRouteEventKind = (value: string): OwnerNetworkRouteEventKind =>
  isRouteEventKind(value) ? value : "logs";

const normalizeOptionalLabel = (
  value: string | null | undefined,
): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const toGroupRoleRecord = (row: {
  tenantId: string;
  fedId: string;
  chatId: string;
  role: string;
  label: string | null;
}): OwnerNetworkGroupRoleRecord => ({
  tenantId: row.tenantId,
  fedId: row.fedId,
  chatId: row.chatId,
  role: asGroupRole(row.role),
  label: row.label ?? undefined,
});

const toRouteRecord = (row: {
  id: string;
  tenantId: string;
  fedId: string;
  sourceChatId: string | null;
  sourceKey: string;
  eventKind: string;
  targetChatId: string;
  enabled: boolean;
}): OwnerNetworkRouteRecord => ({
  id: row.id,
  tenantId: row.tenantId,
  fedId: row.fedId,
  sourceChatId: row.sourceChatId ?? undefined,
  sourceKey: row.sourceKey,
  eventKind: asRouteEventKind(row.eventKind),
  targetChatId: row.targetChatId,
  enabled: row.enabled,
});
