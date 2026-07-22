import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export type AntifloodAction = "ignore" | "delete" | "warn" | "mute" | "ban";

export interface AntifloodConfigState {
  readonly enabled: boolean;
  readonly windowSeconds: number;
  readonly messageLimit: number;
  readonly action: AntifloodAction;
  readonly muteSeconds: number;
  readonly cooldownSeconds: number;
}

export interface AntifloodConfigUpdate {
  readonly enabled?: boolean;
  readonly windowSeconds?: number;
  readonly messageLimit?: number;
  readonly action?: AntifloodAction;
  readonly muteSeconds?: number;
  readonly cooldownSeconds?: number;
}

export interface RecordAntifloodEventInput {
  readonly tenantId: string;
  readonly chatId: string;
  readonly telegramUserId: bigint;
  readonly messageCount: number;
  readonly windowSeconds: number;
  readonly action: AntifloodAction;
}

const validActions: ReadonlySet<string> = new Set([
  "ignore",
  "delete",
  "warn",
  "mute",
  "ban",
]);

const toAction = (value: string): AntifloodAction =>
  validActions.has(value) ? (value as AntifloodAction) : "mute";

export interface AntifloodRepository {
  getConfig(
    tenantId: string,
    chatId: string,
  ): Promise<AntifloodConfigState | null>;
  upsertConfig(
    tenantId: string,
    chatId: string,
    update: AntifloodConfigUpdate,
  ): Promise<AntifloodConfigState>;
  recordEvent(input: RecordAntifloodEventInput): Promise<void>;
}

export class PrismaAntifloodRepository implements AntifloodRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async getConfig(
    _tenantId: string,
    chatId: string,
  ): Promise<AntifloodConfigState | null> {
    const config = await this.client.antifloodConfig.findUnique({
      where: { chatId },
    });

    if (!config) {
      return null;
    }

    return {
      enabled: config.enabled,
      windowSeconds: config.windowSeconds,
      messageLimit: config.messageLimit,
      action: toAction(config.action),
      muteSeconds: config.muteSeconds,
      cooldownSeconds: config.cooldownSeconds,
    };
  }

  async upsertConfig(
    tenantId: string,
    chatId: string,
    update: AntifloodConfigUpdate,
  ): Promise<AntifloodConfigState> {
    const config = await this.client.antifloodConfig.upsert({
      where: { chatId },
      create: {
        tenantId,
        chatId,
        ...(update.enabled !== undefined ? { enabled: update.enabled } : {}),
        ...(update.windowSeconds !== undefined
          ? { windowSeconds: update.windowSeconds }
          : {}),
        ...(update.messageLimit !== undefined
          ? { messageLimit: update.messageLimit }
          : {}),
        ...(update.action !== undefined ? { action: update.action } : {}),
        ...(update.muteSeconds !== undefined
          ? { muteSeconds: update.muteSeconds }
          : {}),
        ...(update.cooldownSeconds !== undefined
          ? { cooldownSeconds: update.cooldownSeconds }
          : {}),
      },
      update: {
        ...(update.enabled !== undefined ? { enabled: update.enabled } : {}),
        ...(update.windowSeconds !== undefined
          ? { windowSeconds: update.windowSeconds }
          : {}),
        ...(update.messageLimit !== undefined
          ? { messageLimit: update.messageLimit }
          : {}),
        ...(update.action !== undefined ? { action: update.action } : {}),
        ...(update.muteSeconds !== undefined
          ? { muteSeconds: update.muteSeconds }
          : {}),
        ...(update.cooldownSeconds !== undefined
          ? { cooldownSeconds: update.cooldownSeconds }
          : {}),
      },
    });

    return {
      enabled: config.enabled,
      windowSeconds: config.windowSeconds,
      messageLimit: config.messageLimit,
      action: toAction(config.action),
      muteSeconds: config.muteSeconds,
      cooldownSeconds: config.cooldownSeconds,
    };
  }

  async recordEvent(input: RecordAntifloodEventInput): Promise<void> {
    await this.client.antifloodEvent.create({
      data: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        telegramUserId: input.telegramUserId,
        messageCount: input.messageCount,
        windowSeconds: input.windowSeconds,
        action: input.action,
      },
    });
  }
}
