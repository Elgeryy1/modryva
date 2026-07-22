import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export interface BlocklistEntryRecord {
  readonly trigger: string;
  readonly reason: string | undefined;
}

export interface HygieneState {
  readonly cleanService: boolean;
  readonly cleanWelcome: boolean;
  readonly nightMode: boolean;
  readonly nightStart: number;
  readonly nightEnd: number;
  readonly welcomeMute: boolean;
  readonly autoApprove: boolean;
  readonly rtlFilter: boolean;
  readonly cjkFilter: boolean;
  readonly language: string;
  readonly blockKnownSpammers: boolean;
  /** Master "passive mode": bot does ONLY Guardian + games (see resolveBotMode). */
  readonly passiveMode: boolean;
  /** Category gates (only meaningful when passiveMode is off). Default true. */
  readonly autoModeration: boolean;
  readonly autoCleanup: boolean;
  readonly autoMessages: boolean;
}

export interface HygienePatch {
  readonly cleanService?: boolean;
  readonly cleanWelcome?: boolean;
  readonly nightMode?: boolean;
  readonly nightStart?: number;
  readonly nightEnd?: number;
  readonly welcomeMute?: boolean;
  readonly autoApprove?: boolean;
  readonly rtlFilter?: boolean;
  readonly cjkFilter?: boolean;
  readonly language?: string;
  readonly blockKnownSpammers?: boolean;
  readonly passiveMode?: boolean;
  readonly autoModeration?: boolean;
  readonly autoCleanup?: boolean;
  readonly autoMessages?: boolean;
}

export interface MembershipGateState {
  readonly requiredTelegramChatId: bigint;
}

export const defaultHygieneState: HygieneState = {
  cleanService: false,
  cleanWelcome: false,
  nightMode: false,
  nightStart: 23,
  nightEnd: 7,
  welcomeMute: false,
  autoApprove: false,
  rtlFilter: false,
  cjkFilter: false,
  language: "es",
  blockKnownSpammers: false,
  passiveMode: false,
  autoModeration: true,
  autoCleanup: true,
  autoMessages: true,
};

/**
 * Group protection config that is not big enough to warrant its own repository
 * each: banned-word blocklists (entries + punishment mode) and chat hygiene
 * (clean service messages, clean welcome, night mode). Grouped to keep the
 * BotUpdateService constructor from growing another two dependencies.
 */
export interface GroupProtectionRepository {
  listBlocklist(chatId: string): Promise<BlocklistEntryRecord[]>;
  addBlocklist(
    tenantId: string,
    chatId: string,
    trigger: string,
    reason: string | undefined,
  ): Promise<void>;
  removeBlocklist(chatId: string, trigger: string): Promise<boolean>;
  removeAllBlocklist(chatId: string): Promise<number>;
  getBlocklistMode(chatId: string): Promise<string>;
  setBlocklistMode(
    tenantId: string,
    chatId: string,
    mode: string,
  ): Promise<void>;
  getHygiene(chatId: string): Promise<HygieneState>;
  setHygiene(
    tenantId: string,
    chatId: string,
    patch: HygienePatch,
  ): Promise<HygieneState>;
  markVerified(tenantId: string, telegramUserId: bigint): Promise<void>;
  isVerified(tenantId: string, telegramUserId: bigint): Promise<boolean>;
  /**
   * Pending "send me the text" state for the settings panel: after tapping
   * "change text" the user's next DM is captured as the new value.
   */
  setPendingEdit(input: {
    tenantId: string;
    telegramUserId: bigint;
    field: string;
    groupTelegramChatId: bigint;
  }): Promise<void>;
  getPendingEdit(
    tenantId: string,
    telegramUserId: bigint,
  ): Promise<{ field: string; groupTelegramChatId: bigint } | null>;
  clearPendingEdit(tenantId: string, telegramUserId: bigint): Promise<void>;
  /** The chat another chat must belong to, if this chat gates membership on one. */
  getMembershipGate(chatId: string): Promise<MembershipGateState | null>;
  /** Every chat requirement for this group. Used by owner networks. */
  listMembershipGates(chatId: string): Promise<readonly MembershipGateState[]>;
  /** `requiredTelegramChatId: null` clears the gate (no requirement). */
  setMembershipGate(
    tenantId: string,
    chatId: string,
    telegramChatId: bigint,
    requiredTelegramChatId: bigint | null,
  ): Promise<MembershipGateState | null>;
  /** Replaces all required chats for the group. Empty array clears the gate. */
  setMembershipGates(
    tenantId: string,
    chatId: string,
    telegramChatId: bigint,
    requiredTelegramChatIds: readonly bigint[],
  ): Promise<readonly MembershipGateState[]>;
  /**
   * Reverse lookup for the `chat_member` listener: every gate that requires
   * membership in the given (Telegram) chat, so a departure there can be
   * enforced in each gated chat without waiting for the person to speak.
   */
  getGatesRequiring(
    requiredTelegramChatId: bigint,
  ): Promise<readonly { chatId: string; telegramChatId: bigint }[]>;
}

export class PrismaGroupProtectionRepository
  implements GroupProtectionRepository
{
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async listBlocklist(chatId: string): Promise<BlocklistEntryRecord[]> {
    const entries = await this.client.blocklistEntry.findMany({
      where: { chatId },
      orderBy: { createdAt: "asc" },
    });

    return entries.map((entry) => ({
      trigger: entry.trigger,
      reason: entry.reason ?? undefined,
    }));
  }

  async addBlocklist(
    tenantId: string,
    chatId: string,
    trigger: string,
    reason: string | undefined,
  ): Promise<void> {
    await this.client.blocklistEntry.upsert({
      where: { chatId_trigger: { chatId, trigger } },
      create: {
        tenantId,
        chatId,
        trigger,
        ...(reason ? { reason } : {}),
      },
      update: { ...(reason ? { reason } : { reason: null }) },
    });
  }

  async removeBlocklist(chatId: string, trigger: string): Promise<boolean> {
    const result = await this.client.blocklistEntry.deleteMany({
      where: { chatId, trigger },
    });

    return result.count > 0;
  }

  async removeAllBlocklist(chatId: string): Promise<number> {
    const result = await this.client.blocklistEntry.deleteMany({
      where: { chatId },
    });

    return result.count;
  }

  async getBlocklistMode(chatId: string): Promise<string> {
    const config = await this.client.blocklistConfig.findUnique({
      where: { chatId },
    });

    return config?.mode ?? "delete";
  }

  async setBlocklistMode(
    tenantId: string,
    chatId: string,
    mode: string,
  ): Promise<void> {
    await this.client.blocklistConfig.upsert({
      where: { chatId },
      create: { tenantId, chatId, mode },
      update: { mode },
    });
  }

  async getHygiene(chatId: string): Promise<HygieneState> {
    const config = await this.client.groupHygieneConfig.findUnique({
      where: { chatId },
    });

    if (!config) {
      return defaultHygieneState;
    }

    return {
      cleanService: config.cleanService,
      cleanWelcome: config.cleanWelcome,
      nightMode: config.nightMode,
      nightStart: config.nightStart,
      nightEnd: config.nightEnd,
      welcomeMute: config.welcomeMute,
      autoApprove: config.autoApprove,
      rtlFilter: config.rtlFilter,
      cjkFilter: config.cjkFilter,
      language: config.language,
      blockKnownSpammers: config.blockKnownSpammers,
      passiveMode: config.passiveMode,
      autoModeration: config.autoModeration,
      autoCleanup: config.autoCleanup,
      autoMessages: config.autoMessages,
    };
  }

  async setHygiene(
    tenantId: string,
    chatId: string,
    patch: HygienePatch,
  ): Promise<HygieneState> {
    const data = {
      ...(patch.cleanService !== undefined
        ? { cleanService: patch.cleanService }
        : {}),
      ...(patch.cleanWelcome !== undefined
        ? { cleanWelcome: patch.cleanWelcome }
        : {}),
      ...(patch.nightMode !== undefined ? { nightMode: patch.nightMode } : {}),
      ...(patch.nightStart !== undefined
        ? { nightStart: patch.nightStart }
        : {}),
      ...(patch.nightEnd !== undefined ? { nightEnd: patch.nightEnd } : {}),
      ...(patch.welcomeMute !== undefined
        ? { welcomeMute: patch.welcomeMute }
        : {}),
      ...(patch.autoApprove !== undefined
        ? { autoApprove: patch.autoApprove }
        : {}),
      ...(patch.rtlFilter !== undefined ? { rtlFilter: patch.rtlFilter } : {}),
      ...(patch.cjkFilter !== undefined ? { cjkFilter: patch.cjkFilter } : {}),
      ...(patch.language !== undefined ? { language: patch.language } : {}),
      ...(patch.blockKnownSpammers !== undefined
        ? { blockKnownSpammers: patch.blockKnownSpammers }
        : {}),
      ...(patch.passiveMode !== undefined
        ? { passiveMode: patch.passiveMode }
        : {}),
      ...(patch.autoModeration !== undefined
        ? { autoModeration: patch.autoModeration }
        : {}),
      ...(patch.autoCleanup !== undefined
        ? { autoCleanup: patch.autoCleanup }
        : {}),
      ...(patch.autoMessages !== undefined
        ? { autoMessages: patch.autoMessages }
        : {}),
    };

    const config = await this.client.groupHygieneConfig.upsert({
      where: { chatId },
      create: { tenantId, chatId, ...data },
      update: data,
    });

    return {
      cleanService: config.cleanService,
      cleanWelcome: config.cleanWelcome,
      nightMode: config.nightMode,
      nightStart: config.nightStart,
      nightEnd: config.nightEnd,
      welcomeMute: config.welcomeMute,
      autoApprove: config.autoApprove,
      rtlFilter: config.rtlFilter,
      cjkFilter: config.cjkFilter,
      language: config.language,
      blockKnownSpammers: config.blockKnownSpammers,
      passiveMode: config.passiveMode,
      autoModeration: config.autoModeration,
      autoCleanup: config.autoCleanup,
      autoMessages: config.autoMessages,
    };
  }

  async markVerified(tenantId: string, telegramUserId: bigint): Promise<void> {
    await this.client.verifiedUser.upsert({
      where: { tenantId_telegramUserId: { tenantId, telegramUserId } },
      create: { tenantId, telegramUserId },
      update: {},
    });
  }

  async isVerified(tenantId: string, telegramUserId: bigint): Promise<boolean> {
    const row = await this.client.verifiedUser.findUnique({
      where: { tenantId_telegramUserId: { tenantId, telegramUserId } },
    });
    return row !== null;
  }

  async setPendingEdit(input: {
    tenantId: string;
    telegramUserId: bigint;
    field: string;
    groupTelegramChatId: bigint;
  }): Promise<void> {
    await this.client.panelEditState.upsert({
      where: {
        tenantId_telegramUserId: {
          tenantId: input.tenantId,
          telegramUserId: input.telegramUserId,
        },
      },
      create: {
        tenantId: input.tenantId,
        telegramUserId: input.telegramUserId,
        field: input.field,
        groupTelegramChatId: input.groupTelegramChatId,
      },
      update: {
        field: input.field,
        groupTelegramChatId: input.groupTelegramChatId,
      },
    });
  }

  async getPendingEdit(
    tenantId: string,
    telegramUserId: bigint,
  ): Promise<{ field: string; groupTelegramChatId: bigint } | null> {
    const row = await this.client.panelEditState.findUnique({
      where: { tenantId_telegramUserId: { tenantId, telegramUserId } },
    });
    return row
      ? { field: row.field, groupTelegramChatId: row.groupTelegramChatId }
      : null;
  }

  async clearPendingEdit(
    tenantId: string,
    telegramUserId: bigint,
  ): Promise<void> {
    await this.client.panelEditState.deleteMany({
      where: { tenantId, telegramUserId },
    });
  }

  async getMembershipGate(chatId: string): Promise<MembershipGateState | null> {
    const gate = await this.client.groupMembershipGate.findFirst({
      where: { chatId },
      orderBy: { createdAt: "asc" },
    });
    return gate
      ? { requiredTelegramChatId: gate.requiredTelegramChatId }
      : null;
  }

  async listMembershipGates(
    chatId: string,
  ): Promise<readonly MembershipGateState[]> {
    const gates = await this.client.groupMembershipGate.findMany({
      where: { chatId },
      orderBy: { createdAt: "asc" },
      select: { requiredTelegramChatId: true },
    });
    return gates.map((gate) => ({
      requiredTelegramChatId: gate.requiredTelegramChatId,
    }));
  }

  async setMembershipGate(
    tenantId: string,
    chatId: string,
    telegramChatId: bigint,
    requiredTelegramChatId: bigint | null,
  ): Promise<MembershipGateState | null> {
    if (requiredTelegramChatId === null) {
      await this.client.groupMembershipGate.deleteMany({ where: { chatId } });
      return null;
    }
    await this.client.$transaction([
      this.client.groupMembershipGate.deleteMany({ where: { chatId } }),
      this.client.groupMembershipGate.create({
        data: { tenantId, chatId, telegramChatId, requiredTelegramChatId },
      }),
    ]);
    return { requiredTelegramChatId };
  }

  async setMembershipGates(
    tenantId: string,
    chatId: string,
    telegramChatId: bigint,
    requiredTelegramChatIds: readonly bigint[],
  ): Promise<readonly MembershipGateState[]> {
    const uniqueIds = [...new Set(requiredTelegramChatIds)];
    await this.client.$transaction([
      this.client.groupMembershipGate.deleteMany({ where: { chatId } }),
      ...(uniqueIds.length > 0
        ? [
            this.client.groupMembershipGate.createMany({
              data: uniqueIds.map((requiredTelegramChatId) => ({
                tenantId,
                chatId,
                telegramChatId,
                requiredTelegramChatId,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);
    return uniqueIds.map((requiredTelegramChatId) => ({
      requiredTelegramChatId,
    }));
  }

  async getGatesRequiring(
    requiredTelegramChatId: bigint,
  ): Promise<readonly { chatId: string; telegramChatId: bigint }[]> {
    const gates = await this.client.groupMembershipGate.findMany({
      where: { requiredTelegramChatId },
      select: { chatId: true, telegramChatId: true },
    });
    return gates;
  }
}
