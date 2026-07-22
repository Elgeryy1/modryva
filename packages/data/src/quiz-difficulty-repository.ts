import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * Per-user, per-chat quiz difficulty level (1..5) for the adaptive solo quiz
 * arcade. Pure storage only: the accuracy/next-level math lives in
 * `quiz-adaptive.ts` (`accuracy`, `nextDifficulty` in `@superbot/module-games`)
 * — this repository just persists whatever level the caller decides to store,
 * and hands back 1 (the easiest level) for anyone who has never played, so
 * `getLevel` always returns a usable value instead of null/undefined.
 */
export interface QuizDifficultyRepository {
  /** The caller's current difficulty level for this chat, or 1 if never set. */
  getLevel(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
  ): Promise<number>;
  /** Overwrites (upserts) the caller's difficulty level for this chat. */
  setLevel(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
    level: number,
  ): Promise<void>;
}

const DEFAULT_LEVEL = 1;

export class PrismaQuizDifficultyRepository
  implements QuizDifficultyRepository
{
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async getLevel(
    _tenantId: string,
    chatId: string,
    telegramUserId: bigint,
  ): Promise<number> {
    const row = await this.client.quizDifficultyState.findUnique({
      where: { chatId_telegramUserId: { chatId, telegramUserId } },
    });
    return row?.level ?? DEFAULT_LEVEL;
  }

  async setLevel(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
    level: number,
  ): Promise<void> {
    await this.client.quizDifficultyState.upsert({
      where: { chatId_telegramUserId: { chatId, telegramUserId } },
      create: { tenantId, chatId, telegramUserId, level },
      update: { level },
    });
  }
}

/** Store en memoria usado como default del constructor (tests). */
export class InMemoryQuizDifficultyRepository
  implements QuizDifficultyRepository
{
  private readonly rows = new Map<string, number>();

  private keyFor(chatId: string, telegramUserId: bigint): string {
    return `${chatId} ${telegramUserId.toString()}`;
  }

  async getLevel(
    _tenantId: string,
    chatId: string,
    telegramUserId: bigint,
  ): Promise<number> {
    return this.rows.get(this.keyFor(chatId, telegramUserId)) ?? DEFAULT_LEVEL;
  }

  async setLevel(
    _tenantId: string,
    chatId: string,
    telegramUserId: bigint,
    level: number,
  ): Promise<void> {
    this.rows.set(this.keyFor(chatId, telegramUserId), level);
  }
}
