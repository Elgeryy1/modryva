import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export interface AiHistoryMessage {
  readonly role: string;
  readonly content: string;
}

export interface RecordAiTurnInput {
  readonly tenantId: string;
  readonly chatId: string;
  readonly telegramUserId: bigint;
  readonly provider: string;
  readonly userContent: string;
  readonly assistantContent: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
}

export type AiMemoryScope = "user" | "chat";

export interface AiMemoryRecord {
  readonly scope: AiMemoryScope;
  readonly key: string;
  readonly value: string;
  readonly confidence: number;
  readonly updatedAt: Date;
}

export interface GetAiMemoriesInput {
  readonly tenantId: string;
  readonly chatId?: string;
  readonly telegramUserId?: bigint;
}

export interface UpsertAiMemoryInput {
  readonly tenantId: string;
  readonly scope: AiMemoryScope;
  readonly chatId?: string;
  readonly telegramUserId?: bigint;
  readonly key: string;
  readonly value: string;
  readonly source?: string;
  readonly confidence?: number;
}

/** One row of the user's personal memory, with its id so the manage-memory
 * commands (/memoria, /olvida) can address a specific entry. */
export interface AiMemoryListItem {
  readonly id: string;
  readonly key: string;
  readonly value: string;
  readonly source: string;
}

export interface ListUserMemoriesInput {
  readonly tenantId: string;
  readonly telegramUserId: bigint;
}

export interface DeleteMemoryInput {
  readonly tenantId: string;
  readonly id: string;
}

export interface ClearUserMemoriesInput {
  readonly tenantId: string;
  readonly telegramUserId: bigint;
}

export interface AiRepository {
  getRecentHistory(
    chatId: string,
    telegramUserId: bigint,
    limit?: number,
  ): Promise<AiHistoryMessage[]>;
  recordTurn(input: RecordAiTurnInput): Promise<void>;
  usageTokens(tenantId: string, chatId: string): Promise<number>;
  clearConversation(chatId: string, telegramUserId: bigint): Promise<void>;
  getMemories(input: GetAiMemoriesInput): Promise<AiMemoryRecord[]>;
  upsertMemory(input: UpsertAiMemoryInput): Promise<void>;
  /** The caller's own personal (scope=user) memories, oldest first so the
   * numbering in /memoria is stable for a following /olvida <n>. */
  listUserMemories(input: ListUserMemoriesInput): Promise<AiMemoryListItem[]>;
  /** Delete one memory by id, scoped to the tenant so a caller can never remove
   * another bot's row by guessing an id. Returns whether a row was removed. */
  deleteMemory(input: DeleteMemoryInput): Promise<boolean>;
  /** Wipe all of the caller's personal memories. Returns how many were removed.
   * Chat-scoped facts (shared) are intentionally left untouched. */
  clearUserMemories(input: ClearUserMemoriesInput): Promise<number>;
}

export class PrismaAiRepository implements AiRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  private async ensureConversation(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
  ): Promise<string> {
    const conversation = await this.client.aiConversation.upsert({
      where: { chatId_telegramUserId: { chatId, telegramUserId } },
      create: { tenantId, chatId, telegramUserId },
      update: {},
    });
    return conversation.id;
  }

  async getRecentHistory(
    chatId: string,
    telegramUserId: bigint,
    limit = 6,
  ): Promise<AiHistoryMessage[]> {
    const conversation = await this.client.aiConversation.findUnique({
      where: { chatId_telegramUserId: { chatId, telegramUserId } },
    });

    if (!conversation) {
      return [];
    }

    const messages = await this.client.aiMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return messages
      .reverse()
      .map((message) => ({ role: message.role, content: message.content }));
  }

  async recordTurn(input: RecordAiTurnInput): Promise<void> {
    const conversationId = await this.ensureConversation(
      input.tenantId,
      input.chatId,
      input.telegramUserId,
    );

    await this.client.aiMessage.createMany({
      data: [
        { conversationId, role: "user", content: input.userContent },
        {
          conversationId,
          role: "assistant",
          content: input.assistantContent,
        },
      ],
    });

    await this.client.aiUsage.create({
      data: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        telegramUserId: input.telegramUserId,
        provider: input.provider,
        tokensIn: input.tokensIn,
        tokensOut: input.tokensOut,
      },
    });
  }

  async usageTokens(tenantId: string, chatId: string): Promise<number> {
    const result = await this.client.aiUsage.aggregate({
      where: { tenantId, chatId },
      _sum: { tokensIn: true, tokensOut: true },
    });

    return (result._sum.tokensIn ?? 0) + (result._sum.tokensOut ?? 0);
  }

  async clearConversation(
    chatId: string,
    telegramUserId: bigint,
  ): Promise<void> {
    await this.client.aiConversation.deleteMany({
      where: { chatId, telegramUserId },
    });
  }

  async getMemories(input: GetAiMemoriesInput): Promise<AiMemoryRecord[]> {
    const subjectIds = [
      ...(input.telegramUserId
        ? [`user:${input.telegramUserId.toString()}`]
        : []),
      ...(input.chatId ? [`chat:${input.chatId}`] : []),
    ];

    if (subjectIds.length === 0) {
      return [];
    }

    const memories = await this.client.aiMemory.findMany({
      where: {
        tenantId: input.tenantId,
        subjectId: { in: subjectIds },
      },
      orderBy: [{ scope: "asc" }, { updatedAt: "desc" }],
      take: 24,
    });

    return memories.map((memory) => ({
      scope: memory.scope === "chat" ? "chat" : "user",
      key: memory.key,
      value: memory.value,
      confidence: memory.confidence,
      updatedAt: memory.updatedAt,
    }));
  }

  async upsertMemory(input: UpsertAiMemoryInput): Promise<void> {
    const subjectId =
      input.scope === "chat"
        ? input.chatId
          ? `chat:${input.chatId}`
          : undefined
        : input.telegramUserId
          ? `user:${input.telegramUserId.toString()}`
          : undefined;

    if (!subjectId) {
      return;
    }

    await this.client.aiMemory.upsert({
      where: {
        tenantId_scope_subjectId_key: {
          tenantId: input.tenantId,
          scope: input.scope,
          subjectId,
          key: input.key,
        },
      },
      create: {
        tenantId: input.tenantId,
        scope: input.scope,
        subjectId,
        ...(input.chatId ? { chatId: input.chatId } : {}),
        ...(input.telegramUserId
          ? { telegramUserId: input.telegramUserId }
          : {}),
        key: input.key,
        value: input.value,
        source: input.source ?? "user",
        confidence: input.confidence ?? 0.8,
      },
      update: {
        value: input.value,
        source: input.source ?? "user",
        confidence: input.confidence ?? 0.8,
      },
    });
  }

  async listUserMemories(
    input: ListUserMemoriesInput,
  ): Promise<AiMemoryListItem[]> {
    const rows = await this.client.aiMemory.findMany({
      where: {
        tenantId: input.tenantId,
        subjectId: `user:${input.telegramUserId.toString()}`,
      },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      key: row.key,
      value: row.value,
      source: row.source,
    }));
  }

  async deleteMemory(input: DeleteMemoryInput): Promise<boolean> {
    // deleteMany with the tenant in the filter so a caller can never delete a
    // row that belongs to another bot by guessing its id.
    const result = await this.client.aiMemory.deleteMany({
      where: { id: input.id, tenantId: input.tenantId },
    });
    return result.count > 0;
  }

  async clearUserMemories(input: ClearUserMemoriesInput): Promise<number> {
    const result = await this.client.aiMemory.deleteMany({
      where: {
        tenantId: input.tenantId,
        subjectId: `user:${input.telegramUserId.toString()}`,
      },
    });
    return result.count;
  }
}
