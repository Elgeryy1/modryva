import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * Server-side session for the "/memoria" Simon-sequence minigame
 * (modules/games/src/memory-game.ts: generateMemorySequence/checkMemoryAnswer).
 * We never persist the expected sequence itself — only the `seed` + `length`
 * needed to regenerate it deterministically at verify time. One active
 * session per (chatId, telegramUserId): starting a new one replaces any
 * previous, unanswered session for that player in that chat.
 */
export interface MemorySequenceSessionState {
  readonly id: string;
  readonly tenantId: string;
  readonly chatId: string;
  readonly telegramUserId: bigint;
  readonly seed: number;
  readonly length: number;
  readonly startedAt: Date;
}

export interface StartMemorySequenceInput {
  readonly tenantId: string;
  readonly chatId: string;
  readonly telegramUserId: bigint;
  readonly seed: number;
  readonly length: number;
}

export interface MemorySequenceRepository {
  /** Opens (or replaces) the single active session for this player in this chat. */
  start(
    input: StartMemorySequenceInput,
  ): Promise<MemorySequenceSessionState>;
  /** The player's currently open session in this chat, or null if none. */
  getActive(
    chatId: string,
    telegramUserId: bigint,
  ): Promise<MemorySequenceSessionState | null>;
  /** Closes (deletes) the player's session in this chat. Idempotent. */
  clear(chatId: string, telegramUserId: bigint): Promise<void>;
}

const toState = (row: {
  id: string;
  tenantId: string;
  chatId: string;
  telegramUserId: bigint;
  seed: number;
  length: number;
  startedAt: Date;
}): MemorySequenceSessionState => ({
  id: row.id,
  tenantId: row.tenantId,
  chatId: row.chatId,
  telegramUserId: row.telegramUserId,
  seed: row.seed,
  length: row.length,
  startedAt: row.startedAt,
});

export class PrismaMemorySequenceRepository
  implements MemorySequenceRepository
{
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async start(
    input: StartMemorySequenceInput,
  ): Promise<MemorySequenceSessionState> {
    const row = await this.client.memorySequenceSession.upsert({
      where: {
        chatId_telegramUserId: {
          chatId: input.chatId,
          telegramUserId: input.telegramUserId,
        },
      },
      create: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        telegramUserId: input.telegramUserId,
        seed: input.seed,
        length: input.length,
      },
      update: {
        tenantId: input.tenantId,
        seed: input.seed,
        length: input.length,
        startedAt: new Date(),
      },
    });

    return toState(row);
  }

  async getActive(
    chatId: string,
    telegramUserId: bigint,
  ): Promise<MemorySequenceSessionState | null> {
    const row = await this.client.memorySequenceSession.findUnique({
      where: { chatId_telegramUserId: { chatId, telegramUserId } },
    });

    return row ? toState(row) : null;
  }

  async clear(chatId: string, telegramUserId: bigint): Promise<void> {
    await this.client.memorySequenceSession.deleteMany({
      where: { chatId, telegramUserId },
    });
  }
}

/** Store en memoria usado como default del constructor (tests / dev sin DB). */
export class InMemoryMemorySequenceRepository
  implements MemorySequenceRepository
{
  private readonly sessions = new Map<string, MemorySequenceSessionState>();
  private sequence = 0;

  private keyFor(chatId: string, telegramUserId: bigint): string {
    return `${chatId}:${telegramUserId}`;
  }

  async start(
    input: StartMemorySequenceInput,
  ): Promise<MemorySequenceSessionState> {
    this.sequence += 1;
    const state: MemorySequenceSessionState = {
      id: `mem_${this.sequence}`,
      tenantId: input.tenantId,
      chatId: input.chatId,
      telegramUserId: input.telegramUserId,
      seed: input.seed,
      length: input.length,
      startedAt: new Date(),
    };
    this.sessions.set(this.keyFor(input.chatId, input.telegramUserId), state);
    return state;
  }

  async getActive(
    chatId: string,
    telegramUserId: bigint,
  ): Promise<MemorySequenceSessionState | null> {
    return this.sessions.get(this.keyFor(chatId, telegramUserId)) ?? null;
  }

  async clear(chatId: string, telegramUserId: bigint): Promise<void> {
    this.sessions.delete(this.keyFor(chatId, telegramUserId));
  }
}
