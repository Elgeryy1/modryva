import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export type AutomationTrigger =
  | { kind: "contains_text"; text: string }
  | { kind: "contains_link" }
  | { kind: "new_member" }
  | { kind: "report" }
  | { kind: "schedule"; cron: string }
  | { kind: "high_risk" };

export type AutomationCondition =
  | { kind: "none" }
  | { kind: "is_new_user"; maxAgeHours: number }
  | { kind: "not_in_chat"; telegramChatId: string }
  | { kind: "missing_badge"; badge: string }
  | { kind: "source_chat"; chatId: string };

export type AutomationAction =
  | { kind: "delete" }
  | { kind: "reply"; text: string }
  | { kind: "quarantine" }
  | { kind: "notify_staff"; text: string }
  | { kind: "log"; text: string }
  | { kind: "mute"; durationMs?: number }
  | { kind: "webhook"; url: string }
  | { kind: "assign_mission"; missionKind: string };

export interface AutomationRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly fedId: string;
  readonly chatId: string | null;
  readonly name: string;
  readonly trigger: AutomationTrigger;
  readonly condition: AutomationCondition;
  readonly action: AutomationAction;
  readonly enabled: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AutomationPatch {
  readonly name?: string;
  readonly trigger?: AutomationTrigger;
  readonly condition?: AutomationCondition;
  readonly action?: AutomationAction;
  readonly enabled?: boolean;
}

export interface AutomationRepository {
  create(
    tenantId: string,
    fedId: string,
    chatId: string | null,
    name: string,
    trigger: AutomationTrigger,
    condition: AutomationCondition,
    action: AutomationAction,
  ): Promise<AutomationRecord>;
  list(fedId: string, chatId?: string): Promise<AutomationRecord[]>;
  update(id: string, patch: AutomationPatch): Promise<AutomationRecord | null>;
  remove(id: string): Promise<boolean>;
  setEnabled(id: string, enabled: boolean): Promise<boolean>;
}

interface AutomationRow {
  id: string;
  tenantId: string;
  fedId: string;
  chatId: string | null;
  name: string;
  trigger: unknown;
  condition: unknown;
  action: unknown;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const toRecord = (row: AutomationRow): AutomationRecord => ({
  id: row.id,
  tenantId: row.tenantId,
  fedId: row.fedId,
  chatId: row.chatId,
  name: row.name,
  trigger: row.trigger as AutomationTrigger,
  condition: row.condition as AutomationCondition,
  action: row.action as AutomationAction,
  enabled: row.enabled,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export class PrismaAutomationRepository implements AutomationRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async create(
    tenantId: string,
    fedId: string,
    chatId: string | null,
    name: string,
    trigger: AutomationTrigger,
    condition: AutomationCondition,
    action: AutomationAction,
  ): Promise<AutomationRecord> {
    const row = await this.client.ownerNetworkAutomation.create({
      data: {
        tenantId,
        fedId,
        chatId,
        name,
        trigger,
        condition,
        action,
      },
    });
    return toRecord(row);
  }

  async list(fedId: string, chatId?: string): Promise<AutomationRecord[]> {
    const rows = await this.client.ownerNetworkAutomation.findMany({
      where: chatId ? { fedId, OR: [{ chatId }, { chatId: null }] } : { fedId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toRecord);
  }

  async update(
    id: string,
    patch: AutomationPatch,
  ): Promise<AutomationRecord | null> {
    try {
      const row = await this.client.ownerNetworkAutomation.update({
        where: { id },
        data: {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.trigger !== undefined ? { trigger: patch.trigger } : {}),
          ...(patch.condition !== undefined
            ? { condition: patch.condition }
            : {}),
          ...(patch.action !== undefined ? { action: patch.action } : {}),
          ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
        },
      });
      return toRecord(row);
    } catch {
      return null;
    }
  }

  async remove(id: string): Promise<boolean> {
    try {
      await this.client.ownerNetworkAutomation.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async setEnabled(id: string, enabled: boolean): Promise<boolean> {
    try {
      await this.client.ownerNetworkAutomation.update({
        where: { id },
        data: { enabled },
      });
      return true;
    } catch {
      return false;
    }
  }
}

export class InMemoryAutomationRepository implements AutomationRepository {
  private readonly rows = new Map<string, AutomationRecord>();
  private seq = 0;

  async create(
    tenantId: string,
    fedId: string,
    chatId: string | null,
    name: string,
    trigger: AutomationTrigger,
    condition: AutomationCondition,
    action: AutomationAction,
  ): Promise<AutomationRecord> {
    this.seq += 1;
    const now = new Date();
    const record: AutomationRecord = {
      id: `auto_${this.seq}`,
      tenantId,
      fedId,
      chatId,
      name,
      trigger,
      condition,
      action,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(record.id, record);
    return record;
  }

  async list(fedId: string, chatId?: string): Promise<AutomationRecord[]> {
    return [...this.rows.values()]
      .filter(
        (row) =>
          row.fedId === fedId &&
          (chatId === undefined ||
            row.chatId === chatId ||
            row.chatId === null),
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async update(
    id: string,
    patch: AutomationPatch,
  ): Promise<AutomationRecord | null> {
    const current = this.rows.get(id);
    if (!current) {
      return null;
    }
    const next: AutomationRecord = {
      ...current,
      ...patch,
      updatedAt: new Date(),
    };
    this.rows.set(id, next);
    return next;
  }

  async remove(id: string): Promise<boolean> {
    return this.rows.delete(id);
  }

  async setEnabled(id: string, enabled: boolean): Promise<boolean> {
    const current = this.rows.get(id);
    if (!current) {
      return false;
    }
    this.rows.set(id, { ...current, enabled, updatedAt: new Date() });
    return true;
  }
}

export interface AutomationEvent {
  readonly kind: "message" | "new_member" | "report";
  readonly text?: string;
  readonly isNewUser?: boolean;
  readonly chatId?: string;
}

const LINK_RE = /https?:\/\/|t\.me\//iu;

const matchesTrigger = (
  trigger: AutomationTrigger,
  event: AutomationEvent,
): boolean => {
  switch (trigger.kind) {
    case "contains_text":
      return (
        event.kind === "message" &&
        typeof event.text === "string" &&
        event.text.toLowerCase().includes(trigger.text.toLowerCase())
      );
    case "contains_link":
      return (
        event.kind === "message" &&
        typeof event.text === "string" &&
        LINK_RE.test(event.text)
      );
    case "new_member":
      return event.kind === "new_member";
    case "report":
      return event.kind === "report";
    // schedule and high_risk need runtime context (a cron clock / a risk
    // score) that this pure AutomationEvent does not carry yet.
    case "schedule":
    case "high_risk":
      return false;
  }
};

const matchesCondition = (
  condition: AutomationCondition,
  event: AutomationEvent,
): boolean => {
  switch (condition.kind) {
    case "none":
      return true;
    case "is_new_user":
      return event.isNewUser === true;
    case "source_chat":
      return event.chatId === condition.chatId;
    // not_in_chat and missing_badge need live membership/badge lookups the
    // bot runtime will supply; the pure matcher can't decide them yet.
    case "not_in_chat":
    case "missing_badge":
      return false;
  }
};

export const matchAutomation = (
  automation: { trigger: AutomationTrigger; condition: AutomationCondition },
  event: AutomationEvent,
): boolean =>
  matchesTrigger(automation.trigger, event) &&
  matchesCondition(automation.condition, event);
