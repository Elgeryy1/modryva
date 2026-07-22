import { Prisma, type PrismaClient } from "@prisma/client";
import {
  rankSpeedAnswers,
  type SpeedAnswer,
  type SpeedRankEntry,
  speedWinner,
} from "@superbot/module-games";
import { prisma as defaultPrisma } from "./client.js";

/**
 * "Juego de velocidad" (/velocidad): one open question per chat, first
 * correct reply wins. The pure ranking (`rankSpeedAnswers`/`speedWinner` in
 * @superbot/module-games) needs plain `{userId, correct, ms}` inputs with no
 * I/O of its own; this repository owns the round + per-user submissions and
 * converts stored rows into that shape when a round is closed.
 *
 * Rounds close lazily (no persisted timer/cron): the caller (bot-update
 * service) checks `closesAt` against "now" on the next relevant command
 * (`/responder` after expiry, or an explicit admin `/cerrarvelocidad`) and
 * calls `closeRound`, which is idempotent — closing an already-closed round
 * just recomputes the same deterministic ranking from the stored answers
 * instead of erroring.
 */

export type SpeedRoundStatus = "open" | "closed";

export interface SpeedRoundRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly chatId: string;
  readonly question: string;
  readonly answer: string;
  readonly status: SpeedRoundStatus;
  readonly startedAt: Date;
  readonly closesAt: Date;
  readonly winnerUserId: bigint | null;
}

/** Result of closing a round: the full ranking plus the winner, if any. */
export interface SpeedRoundCloseResult {
  readonly ranked: readonly SpeedRankEntry[];
  readonly winnerUserId: string | null;
}

export interface SpeedGameRepository {
  /**
   * Opens a new round. Callers are responsible for checking there is no
   * other open round for this chat first (`getOpenRound`) — this method does
   * not enforce that so a single chat could in theory have two open rounds;
   * the bot command layer gates it, mirroring how other single-active-item
   * flows (e.g. giveaways) are gated at the call site, not the repository.
   */
  createRound(
    tenantId: string,
    chatId: string,
    question: string,
    answer: string,
    startedAt: Date,
    closesAt: Date,
    createdBy?: bigint,
  ): Promise<SpeedRoundRecord>;

  /** The most recently started round for this chat, if it is still open. */
  getOpenRound(
    tenantId: string,
    chatId: string,
  ): Promise<SpeedRoundRecord | null>;

  getRound(roundId: string): Promise<SpeedRoundRecord | null>;

  /**
   * Records one user's answer for a round. Returns false without writing
   * anything when this user already answered this round (first answer per
   * user wins, later ones are ignored) — enforced via a unique
   * (roundId, userId) constraint, mirroring the P2002-as-duplicate pattern
   * used elsewhere in this package (see chip-repository.ts).
   */
  submitAnswer(
    roundId: string,
    userId: bigint,
    answeredAt: Date,
    correct: boolean,
  ): Promise<boolean>;

  /**
   * Marks the round closed (no-op if already closed) and returns the full
   * ranking + winner, computed via the pure `rankSpeedAnswers`/`speedWinner`
   * functions over every stored submission. Throws if the round does not
   * exist.
   */
  closeRound(roundId: string): Promise<SpeedRoundCloseResult>;
}

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

const toRecord = (row: {
  id: string;
  tenantId: string;
  chatId: string;
  question: string;
  answer: string;
  status: string;
  startedAt: Date;
  closesAt: Date;
  winnerUserId: bigint | null;
}): SpeedRoundRecord => ({
  id: row.id,
  tenantId: row.tenantId,
  chatId: row.chatId,
  question: row.question,
  answer: row.answer,
  status: row.status === "closed" ? "closed" : "open",
  startedAt: row.startedAt,
  closesAt: row.closesAt,
  winnerUserId: row.winnerUserId,
});

export class PrismaSpeedGameRepository implements SpeedGameRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async createRound(
    tenantId: string,
    chatId: string,
    question: string,
    answer: string,
    startedAt: Date,
    closesAt: Date,
    createdBy?: bigint,
  ): Promise<SpeedRoundRecord> {
    const round = await this.client.speedRound.create({
      data: {
        tenantId,
        chatId,
        question,
        answer,
        startedAt,
        closesAt,
        ...(createdBy !== undefined ? { createdBy } : {}),
      },
    });
    return toRecord(round);
  }

  async getOpenRound(
    tenantId: string,
    chatId: string,
  ): Promise<SpeedRoundRecord | null> {
    const round = await this.client.speedRound.findFirst({
      where: { tenantId, chatId, status: "open" },
      orderBy: { startedAt: "desc" },
    });
    return round ? toRecord(round) : null;
  }

  async getRound(roundId: string): Promise<SpeedRoundRecord | null> {
    const round = await this.client.speedRound.findUnique({
      where: { id: roundId },
    });
    return round ? toRecord(round) : null;
  }

  async submitAnswer(
    roundId: string,
    userId: bigint,
    answeredAt: Date,
    correct: boolean,
  ): Promise<boolean> {
    try {
      await this.client.speedRoundAnswer.create({
        data: { roundId, userId, answeredAt, correct },
      });
      return true;
    } catch (error) {
      if (isUniqueViolation(error)) {
        return false;
      }
      throw error;
    }
  }

  async closeRound(roundId: string): Promise<SpeedRoundCloseResult> {
    const round = await this.client.speedRound.findUnique({
      where: { id: roundId },
    });
    if (!round) {
      throw new Error(`speed round not found: ${roundId}`);
    }

    const submissions = await this.client.speedRoundAnswer.findMany({
      where: { roundId },
      orderBy: { answeredAt: "asc" },
    });

    const answers: SpeedAnswer[] = submissions.map((submission) => ({
      userId: submission.userId.toString(),
      correct: submission.correct,
      ms: submission.answeredAt.getTime() - round.startedAt.getTime(),
    }));

    const ranked = rankSpeedAnswers(answers);
    const winnerUserId = speedWinner(answers);

    if (round.status !== "closed") {
      await this.client.speedRound.update({
        where: { id: roundId },
        data: {
          status: "closed",
          winnerUserId: winnerUserId ? BigInt(winnerUserId) : null,
        },
      });
    }

    return { ranked, winnerUserId };
  }
}

/** Store en memoria usado como default del constructor (tests). */
export class InMemorySpeedGameRepository implements SpeedGameRepository {
  private readonly rounds = new Map<string, SpeedRoundRecord>();
  private readonly answersByRound = new Map<
    string,
    { userId: bigint; answeredAt: Date; correct: boolean }[]
  >();
  private nextId = 1;

  async createRound(
    tenantId: string,
    chatId: string,
    question: string,
    answer: string,
    startedAt: Date,
    closesAt: Date,
    createdBy?: bigint,
  ): Promise<SpeedRoundRecord> {
    void createdBy;
    const id = `speed-round-${this.nextId}`;
    this.nextId += 1;
    const record: SpeedRoundRecord = {
      id,
      tenantId,
      chatId,
      question,
      answer,
      status: "open",
      startedAt,
      closesAt,
      winnerUserId: null,
    };
    this.rounds.set(id, record);
    this.answersByRound.set(id, []);
    return record;
  }

  async getOpenRound(
    tenantId: string,
    chatId: string,
  ): Promise<SpeedRoundRecord | null> {
    let latest: SpeedRoundRecord | null = null;
    for (const round of this.rounds.values()) {
      if (
        round.tenantId === tenantId &&
        round.chatId === chatId &&
        round.status === "open" &&
        (latest === null || round.startedAt > latest.startedAt)
      ) {
        latest = round;
      }
    }
    return latest;
  }

  async getRound(roundId: string): Promise<SpeedRoundRecord | null> {
    return this.rounds.get(roundId) ?? null;
  }

  async submitAnswer(
    roundId: string,
    userId: bigint,
    answeredAt: Date,
    correct: boolean,
  ): Promise<boolean> {
    const answers = this.answersByRound.get(roundId);
    if (!answers) {
      throw new Error(`speed round not found: ${roundId}`);
    }
    if (answers.some((a) => a.userId === userId)) {
      return false;
    }
    answers.push({ userId, answeredAt, correct });
    return true;
  }

  async closeRound(roundId: string): Promise<SpeedRoundCloseResult> {
    const round = this.rounds.get(roundId);
    if (!round) {
      throw new Error(`speed round not found: ${roundId}`);
    }
    const stored = this.answersByRound.get(roundId) ?? [];

    const answers: SpeedAnswer[] = stored.map((a) => ({
      userId: a.userId.toString(),
      correct: a.correct,
      ms: a.answeredAt.getTime() - round.startedAt.getTime(),
    }));

    const ranked = rankSpeedAnswers(answers);
    const winnerUserId = speedWinner(answers);

    if (round.status !== "closed") {
      this.rounds.set(roundId, {
        ...round,
        status: "closed",
        winnerUserId: winnerUserId ? BigInt(winnerUserId) : null,
      });
    }

    return { ranked, winnerUserId };
  }
}
