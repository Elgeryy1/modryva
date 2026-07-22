import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export type AntiraidMode = "observe" | "enforce";

export interface AntiraidConfigState {
  readonly enabled: boolean;
  readonly windowSeconds: number;
  readonly joinLimit: number;
  readonly mode: AntiraidMode;
  readonly newAccountAgeDays: number;
}

export interface AntiraidConfigUpdate {
  readonly enabled?: boolean;
  readonly windowSeconds?: number;
  readonly joinLimit?: number;
  readonly mode?: AntiraidMode;
  readonly newAccountAgeDays?: number;
}

export interface RecordAntiraidEventInput {
  readonly tenantId: string;
  readonly chatId: string;
  readonly joinCount: number;
  readonly windowSeconds: number;
  readonly mode: AntiraidMode;
}

const toMode = (value: string): AntiraidMode =>
  value === "enforce" ? "enforce" : "observe";

export interface AntiraidRepository {
  getConfig(
    tenantId: string,
    chatId: string,
  ): Promise<AntiraidConfigState | null>;
  upsertConfig(
    tenantId: string,
    chatId: string,
    update: AntiraidConfigUpdate,
  ): Promise<AntiraidConfigState>;
  recordEvent(input: RecordAntiraidEventInput): Promise<void>;
  setUnderAttack(chatId: string, until: Date): Promise<void>;
}

export class PrismaAntiraidRepository implements AntiraidRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async getConfig(
    _tenantId: string,
    chatId: string,
  ): Promise<AntiraidConfigState | null> {
    const config = await this.client.antiraidConfig.findUnique({
      where: { chatId },
    });

    if (!config) {
      return null;
    }

    return {
      enabled: config.enabled,
      windowSeconds: config.windowSeconds,
      joinLimit: config.joinLimit,
      mode: toMode(config.mode),
      newAccountAgeDays: config.newAccountAgeDays,
    };
  }

  async upsertConfig(
    tenantId: string,
    chatId: string,
    update: AntiraidConfigUpdate,
  ): Promise<AntiraidConfigState> {
    const data = {
      ...(update.enabled !== undefined ? { enabled: update.enabled } : {}),
      ...(update.windowSeconds !== undefined
        ? { windowSeconds: update.windowSeconds }
        : {}),
      ...(update.joinLimit !== undefined
        ? { joinLimit: update.joinLimit }
        : {}),
      ...(update.mode !== undefined ? { mode: update.mode } : {}),
      ...(update.newAccountAgeDays !== undefined
        ? { newAccountAgeDays: update.newAccountAgeDays }
        : {}),
    };
    const config = await this.client.antiraidConfig.upsert({
      where: { chatId },
      create: { tenantId, chatId, ...data },
      update: data,
    });

    return {
      enabled: config.enabled,
      windowSeconds: config.windowSeconds,
      joinLimit: config.joinLimit,
      mode: toMode(config.mode),
      newAccountAgeDays: config.newAccountAgeDays,
    };
  }

  async recordEvent(input: RecordAntiraidEventInput): Promise<void> {
    await this.client.antiraidEvent.create({
      data: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        joinCount: input.joinCount,
        windowSeconds: input.windowSeconds,
        mode: input.mode,
      },
    });
  }

  async setUnderAttack(chatId: string, until: Date): Promise<void> {
    await this.client.antiraidConfig.updateMany({
      where: { chatId },
      data: { underAttackUntil: until },
    });
  }
}
