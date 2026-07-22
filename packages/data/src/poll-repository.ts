import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

const toJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const readOptions = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

export interface PollRecord {
  readonly id: string;
  readonly question: string;
  readonly options: string[];
  readonly closed: boolean;
}

export interface PollVoteRow {
  readonly optionIndex: number;
}

export interface PollRepository {
  createPoll(
    tenantId: string,
    chatId: string,
    question: string,
    options: readonly string[],
    createdBy: string | undefined,
  ): Promise<PollRecord>;
  getPoll(pollId: string): Promise<PollRecord | null>;
  recordVote(
    pollId: string,
    telegramUserId: bigint,
    optionIndex: number,
  ): Promise<void>;
  listVotes(pollId: string): Promise<PollVoteRow[]>;
}

export class PrismaPollRepository implements PollRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async createPoll(
    tenantId: string,
    chatId: string,
    question: string,
    options: readonly string[],
    createdBy: string | undefined,
  ): Promise<PollRecord> {
    const poll = await this.client.poll.create({
      data: {
        tenantId,
        chatId,
        question,
        options: toJson([...options]),
        ...(createdBy ? { createdBy } : {}),
      },
    });

    return {
      id: poll.id,
      question: poll.question,
      options: readOptions(poll.options),
      closed: poll.closed,
    };
  }

  async getPoll(pollId: string): Promise<PollRecord | null> {
    const poll = await this.client.poll.findUnique({ where: { id: pollId } });

    return poll
      ? {
          id: poll.id,
          question: poll.question,
          options: readOptions(poll.options),
          closed: poll.closed,
        }
      : null;
  }

  async recordVote(
    pollId: string,
    telegramUserId: bigint,
    optionIndex: number,
  ): Promise<void> {
    await this.client.pollVote.upsert({
      where: { pollId_telegramUserId: { pollId, telegramUserId } },
      create: { pollId, telegramUserId, optionIndex },
      update: { optionIndex },
    });
  }

  async listVotes(pollId: string): Promise<PollVoteRow[]> {
    const votes = await this.client.pollVote.findMany({
      where: { pollId },
      select: { optionIndex: true },
    });

    return votes.map((vote) => ({ optionIndex: vote.optionIndex }));
  }
}
