import type { CaptchaMode, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export type CaptchaModeValue = "button" | "math" | "text";
export type CaptchaFailAction = "ban" | "mute" | "restrict";
export type CaptchaSessionStatus =
  | "pending"
  | "solved"
  | "failed"
  | "expired"
  | "cancelled";

export interface CaptchaConfigState {
  readonly enabled: boolean;
  readonly mode: CaptchaModeValue;
  readonly timeoutSeconds: number;
  readonly maxAttempts: number;
  readonly failAction: CaptchaFailAction;
}

export interface CaptchaConfigUpdate {
  readonly enabled?: boolean;
  readonly mode?: CaptchaModeValue;
  readonly timeoutSeconds?: number;
  readonly maxAttempts?: number;
  readonly failAction?: CaptchaFailAction;
}

export interface CreateCaptchaSessionInput {
  readonly tenantId: string;
  readonly chatId: string;
  readonly telegramUserId: bigint;
  readonly userId?: string;
  readonly mode: CaptchaModeValue;
  readonly challenge: string;
  readonly answerHash: string;
  readonly answerSalt: string;
  readonly maxAttempts: number;
  readonly failAction: CaptchaFailAction;
  readonly expiresAt: Date;
}

export interface CaptchaSessionRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly chatId: string;
  readonly telegramUserId: bigint;
  readonly answerHash: string | null;
  readonly answerSalt: string | null;
  readonly status: CaptchaSessionStatus;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly failAction: CaptchaFailAction;
  readonly expiresAt: Date;
}

const toMode = (value: CaptchaModeValue): CaptchaMode => value as CaptchaMode;

const toRecord = (session: {
  id: string;
  tenantId: string;
  chatId: string;
  telegramUserId: bigint;
  answerHash: string | null;
  answerSalt: string | null;
  status: string;
  attempts: number;
  maxAttempts: number;
  failAction: string;
  expiresAt: Date;
}): CaptchaSessionRecord => ({
  id: session.id,
  tenantId: session.tenantId,
  chatId: session.chatId,
  telegramUserId: session.telegramUserId,
  answerHash: session.answerHash,
  answerSalt: session.answerSalt,
  status: session.status as CaptchaSessionStatus,
  attempts: session.attempts,
  maxAttempts: session.maxAttempts,
  failAction: session.failAction as CaptchaFailAction,
  expiresAt: session.expiresAt,
});

export interface CaptchaRepository {
  getConfig(
    tenantId: string,
    chatId: string,
  ): Promise<CaptchaConfigState | null>;
  upsertConfig(
    tenantId: string,
    chatId: string,
    update: CaptchaConfigUpdate,
  ): Promise<CaptchaConfigState>;
  createSession(
    input: CreateCaptchaSessionInput,
  ): Promise<CaptchaSessionRecord>;
  findPendingSession(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
  ): Promise<CaptchaSessionRecord | null>;
  recordAttempt(
    sessionId: string,
    status: CaptchaSessionStatus,
  ): Promise<CaptchaSessionRecord>;
  listExpiredPending(
    now: Date,
    limit?: number,
  ): Promise<CaptchaSessionRecord[]>;
}

export class PrismaCaptchaRepository implements CaptchaRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async getConfig(
    _tenantId: string,
    chatId: string,
  ): Promise<CaptchaConfigState | null> {
    const config = await this.client.captchaConfig.findUnique({
      where: { chatId },
    });

    if (!config) {
      return null;
    }

    return {
      enabled: config.enabled,
      mode: config.mode as CaptchaModeValue,
      timeoutSeconds: config.timeoutSeconds,
      maxAttempts: config.maxAttempts,
      failAction: config.failAction as CaptchaFailAction,
    };
  }

  async upsertConfig(
    tenantId: string,
    chatId: string,
    update: CaptchaConfigUpdate,
  ): Promise<CaptchaConfigState> {
    const config = await this.client.captchaConfig.upsert({
      where: { chatId },
      create: {
        tenantId,
        chatId,
        ...(update.enabled !== undefined ? { enabled: update.enabled } : {}),
        ...(update.mode !== undefined ? { mode: toMode(update.mode) } : {}),
        ...(update.timeoutSeconds !== undefined
          ? { timeoutSeconds: update.timeoutSeconds }
          : {}),
        ...(update.maxAttempts !== undefined
          ? { maxAttempts: update.maxAttempts }
          : {}),
        ...(update.failAction !== undefined
          ? { failAction: update.failAction }
          : {}),
      },
      update: {
        ...(update.enabled !== undefined ? { enabled: update.enabled } : {}),
        ...(update.mode !== undefined ? { mode: toMode(update.mode) } : {}),
        ...(update.timeoutSeconds !== undefined
          ? { timeoutSeconds: update.timeoutSeconds }
          : {}),
        ...(update.maxAttempts !== undefined
          ? { maxAttempts: update.maxAttempts }
          : {}),
        ...(update.failAction !== undefined
          ? { failAction: update.failAction }
          : {}),
      },
    });

    return {
      enabled: config.enabled,
      mode: config.mode as CaptchaModeValue,
      timeoutSeconds: config.timeoutSeconds,
      maxAttempts: config.maxAttempts,
      failAction: config.failAction as CaptchaFailAction,
    };
  }

  async createSession(
    input: CreateCaptchaSessionInput,
  ): Promise<CaptchaSessionRecord> {
    const session = await this.client.captchaSession.create({
      data: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        telegramUserId: input.telegramUserId,
        mode: toMode(input.mode),
        challenge: input.challenge,
        answerHash: input.answerHash,
        answerSalt: input.answerSalt,
        maxAttempts: input.maxAttempts,
        failAction: input.failAction,
        expiresAt: input.expiresAt,
        ...(input.userId ? { userId: input.userId } : {}),
      },
    });

    return toRecord(session);
  }

  async findPendingSession(
    _tenantId: string,
    chatId: string,
    telegramUserId: bigint,
  ): Promise<CaptchaSessionRecord | null> {
    const session = await this.client.captchaSession.findFirst({
      where: { chatId, telegramUserId, status: "pending" },
      orderBy: { createdAt: "desc" },
    });

    return session ? toRecord(session) : null;
  }

  async recordAttempt(
    sessionId: string,
    status: CaptchaSessionStatus,
  ): Promise<CaptchaSessionRecord> {
    const session = await this.client.captchaSession.update({
      where: { id: sessionId },
      data: {
        attempts: { increment: 1 },
        status,
        ...(status === "pending" ? {} : { resolvedAt: new Date() }),
      },
    });

    return toRecord(session);
  }

  async listExpiredPending(
    now: Date,
    limit = 100,
  ): Promise<CaptchaSessionRecord[]> {
    const sessions = await this.client.captchaSession.findMany({
      where: { status: "pending", expiresAt: { lte: now } },
      take: limit,
    });

    return sessions.map(toRecord);
  }
}
