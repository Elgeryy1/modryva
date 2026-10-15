import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export interface AiAccessCodeRecord {
  readonly codePrefix: string;
  readonly days: number;
  readonly note: string | undefined;
  readonly createdByTelegramId: bigint;
  readonly redeemedByChatId: bigint | undefined;
  readonly redeemedAt: Date | undefined;
  readonly createdAt: Date;
}

export type RedeemAiAccessCodeResult =
  | { readonly ok: true; readonly expiresAt: Date }
  | { readonly ok: false; readonly reason: "not-found" | "already-used" };

/** `"chat"` grants the whole group; `"user"` follows the payer everywhere. */
export type AiAccessScope = "chat" | "user";

export interface AiSubscriptionRecord {
  readonly scope: AiAccessScope;
  readonly targetId: bigint;
  readonly telegramUserId: bigint;
  readonly lastChargeId: string;
  readonly currentPeriodEnd: Date;
  readonly canceled: boolean;
}

export interface RecordSubscriptionPaymentInput {
  readonly scope: AiAccessScope;
  readonly targetId: bigint;
  readonly telegramUserId: bigint;
  readonly chargeId: string;
  readonly periodEnd: Date;
}

export type CancelSubscriptionResult =
  | {
      readonly ok: true;
      readonly telegramUserId: bigint;
      readonly lastChargeId: string;
    }
  | { readonly ok: false };

export interface AiAccessRepository {
  /** Whether `chatId` currently has a non-expired AI access grant. */
  hasAccess(chatId: bigint): Promise<boolean>;
  /** Whether `telegramUserId` has a non-expired PERSONAL AI access grant. */
  hasUserAccess(telegramUserId: bigint): Promise<boolean>;
  generateCode(
    createdByTelegramId: bigint,
    days: number,
    note?: string,
  ): Promise<string>;
  listCodes(limit?: number): Promise<readonly AiAccessCodeRecord[]>;
  redeemCode(chatId: bigint, code: string): Promise<RedeemAiAccessCodeResult>;
  /** Called on every successful_payment for the AI pack — initial charge or an automatic monthly renewal. */
  recordSubscriptionPayment(
    input: RecordSubscriptionPaymentInput,
  ): Promise<void>;
  getSubscription(
    scope: AiAccessScope,
    targetId: bigint,
  ): Promise<AiSubscriptionRecord | undefined>;
  /** Marks the subscription as canceled (no further renewals); does NOT revoke access already paid for. */
  cancelSubscription(
    scope: AiAccessScope,
    targetId: bigint,
  ): Promise<CancelSubscriptionResult>;
}

export const normalizeAiAccessCode = (code: string): string =>
  code.trim().toUpperCase();

export const hashAiAccessCode = (code: string): string =>
  createHash("sha256")
    .update(`ai-access:${normalizeAiAccessCode(code)}`)
    .digest("hex");

/** `AI-XXXXXX-XXXXXX`, short enough to type by hand into `/aicode <code>`. */
export const generateAiAccessCodeValue = (): string => {
  const raw = randomBytes(9).toString("base64url").toUpperCase();
  return `AI-${raw.slice(0, 6)}-${raw.slice(6, 12)}`;
};

const daysFromNow = (days: number): Date =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000);

/** The AI pack subscription: 30 days per charge, billed in Telegram Stars. */
export const AI_PACK_SUBSCRIPTION_PERIOD_SECONDS = 2_592_000;
export const AI_PACK_STARS_PRICE = 30;

export class PrismaAiAccessRepository implements AiAccessRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async hasAccess(chatId: bigint): Promise<boolean> {
    const access = await this.client.aiChatAccess.findUnique({
      where: { chatId },
    });
    return Boolean(access && access.expiresAt.getTime() > Date.now());
  }

  async hasUserAccess(telegramUserId: bigint): Promise<boolean> {
    const [personal, dmGrant] = await Promise.all([
      this.client.aiUserAccess.findUnique({ where: { telegramUserId } }),
      // A private chat's id equals the user's id, so a code redeemed in a DM
      // (stored in aiChatAccess) is really a personal grant and must follow the
      // user into other chats. Group chat ids are negative, so they never
      // collide with a user id here.
      this.client.aiChatAccess.findUnique({
        where: { chatId: telegramUserId },
      }),
    ]);
    const now = Date.now();
    return (
      Boolean(personal && personal.expiresAt.getTime() > now) ||
      Boolean(dmGrant && dmGrant.expiresAt.getTime() > now)
    );
  }

  async generateCode(
    createdByTelegramId: bigint,
    days: number,
    note?: string,
  ): Promise<string> {
    const code = generateAiAccessCodeValue();
    await this.client.aiAccessCode.create({
      data: {
        codeHash: hashAiAccessCode(code),
        codePrefix: code.slice(0, 9),
        days,
        createdByTelegramId,
        ...(note ? { note } : {}),
      },
    });
    return code;
  }

  async listCodes(limit = 50): Promise<readonly AiAccessCodeRecord[]> {
    const rows = await this.client.aiAccessCode.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map((row) => ({
      codePrefix: row.codePrefix,
      days: row.days,
      note: row.note ?? undefined,
      createdByTelegramId: row.createdByTelegramId,
      redeemedByChatId: row.redeemedByChatId ?? undefined,
      redeemedAt: row.redeemedAt ?? undefined,
      createdAt: row.createdAt,
    }));
  }

  async redeemCode(
    chatId: bigint,
    code: string,
  ): Promise<RedeemAiAccessCodeResult> {
    const codeHash = hashAiAccessCode(code);
    return this.client.$transaction(async (tx) => {
      const found = await tx.aiAccessCode.findUnique({ where: { codeHash } });
      if (!found) {
        return { ok: false, reason: "not-found" } as const;
      }
      if (found.redeemedByChatId) {
        return { ok: false, reason: "already-used" } as const;
      }

      const claimed = await tx.aiAccessCode.updateMany({
        where: { id: found.id, redeemedByChatId: null },
        data: { redeemedByChatId: chatId, redeemedAt: new Date() },
      });
      if (claimed.count !== 1) {
        return { ok: false, reason: "already-used" } as const;
      }

      const expiresAt = daysFromNow(found.days);
      await tx.aiChatAccess.upsert({
        where: { chatId },
        create: { chatId, expiresAt, grantedByCode: found.codePrefix },
        update: { expiresAt, grantedByCode: found.codePrefix },
      });

      return { ok: true, expiresAt } as const;
    });
  }

  async recordSubscriptionPayment({
    scope,
    targetId,
    telegramUserId,
    chargeId,
    periodEnd,
  }: RecordSubscriptionPaymentInput): Promise<void> {
    await this.client.$transaction(async (tx) => {
      await tx.aiSubscription.upsert({
        where: { scope_targetId: { scope, targetId } },
        create: {
          scope,
          targetId,
          telegramUserId,
          lastChargeId: chargeId,
          currentPeriodEnd: periodEnd,
        },
        update: {
          telegramUserId,
          lastChargeId: chargeId,
          currentPeriodEnd: periodEnd,
          canceled: false,
        },
      });

      if (scope === "chat") {
        await tx.aiChatAccess.upsert({
          where: { chatId: targetId },
          create: {
            chatId: targetId,
            expiresAt: periodEnd,
            grantedByCode: "subscription",
          },
          update: { expiresAt: periodEnd, grantedByCode: "subscription" },
        });
      } else {
        await tx.aiUserAccess.upsert({
          where: { telegramUserId: targetId },
          create: {
            telegramUserId: targetId,
            expiresAt: periodEnd,
            grantedBy: "subscription",
          },
          update: { expiresAt: periodEnd, grantedBy: "subscription" },
        });
      }
    });
  }

  async getSubscription(
    scope: AiAccessScope,
    targetId: bigint,
  ): Promise<AiSubscriptionRecord | undefined> {
    const row = await this.client.aiSubscription.findUnique({
      where: { scope_targetId: { scope, targetId } },
    });
    return row
      ? {
          scope: row.scope as AiAccessScope,
          targetId: row.targetId,
          telegramUserId: row.telegramUserId,
          lastChargeId: row.lastChargeId,
          currentPeriodEnd: row.currentPeriodEnd,
          canceled: row.canceled,
        }
      : undefined;
  }

  async cancelSubscription(
    scope: AiAccessScope,
    targetId: bigint,
  ): Promise<CancelSubscriptionResult> {
    const row = await this.client.aiSubscription.findUnique({
      where: { scope_targetId: { scope, targetId } },
    });
    if (!row) {
      return { ok: false };
    }
    await this.client.aiSubscription.update({
      where: { scope_targetId: { scope, targetId } },
      data: { canceled: true },
    });
    return {
      ok: true,
      telegramUserId: row.telegramUserId,
      lastChargeId: row.lastChargeId,
    };
  }
}

/**
 * No-op stand-in used as the default when no real repository is wired (e.g. a
 * caller that never passes one explicitly) — behaves as if every chat already
 * had AI access, so callers that don't care about gating aren't blocked by it.
 * Production wiring always provides {@link PrismaAiAccessRepository} instead.
 */
export class AlwaysAllowAiAccessRepository implements AiAccessRepository {
  async hasAccess(): Promise<boolean> {
    return true;
  }

  async hasUserAccess(): Promise<boolean> {
    return true;
  }

  async generateCode(): Promise<string> {
    return generateAiAccessCodeValue();
  }

  async listCodes(): Promise<readonly AiAccessCodeRecord[]> {
    return [];
  }

  async redeemCode(): Promise<RedeemAiAccessCodeResult> {
    return { ok: true, expiresAt: daysFromNow(36_500) };
  }

  async recordSubscriptionPayment(): Promise<void> {
    // No-op: this stand-in already grants access to everyone.
  }

  async getSubscription(): Promise<AiSubscriptionRecord | undefined> {
    return undefined;
  }

  async cancelSubscription(): Promise<CancelSubscriptionResult> {
    return { ok: false };
  }
}

interface InMemoryCode {
  readonly seq: number;
  readonly codeHash: string;
  readonly codePrefix: string;
  readonly days: number;
  readonly note: string | undefined;
  readonly createdByTelegramId: bigint;
  readonly createdAt: Date;
  redeemedByChatId: bigint | undefined;
  redeemedAt: Date | undefined;
}

interface InMemorySubscription {
  scope: AiAccessScope;
  targetId: bigint;
  telegramUserId: bigint;
  lastChargeId: string;
  currentPeriodEnd: Date;
  canceled: boolean;
}

export class InMemoryAiAccessRepository implements AiAccessRepository {
  private readonly codes = new Map<string, InMemoryCode>();
  private readonly access = new Map<
    string,
    { expiresAt: Date; grantedByCode: string }
  >();
  private readonly userAccess = new Map<string, { expiresAt: Date }>();
  private readonly subscriptions = new Map<string, InMemorySubscription>();
  private seq = 0;

  private subKey(scope: AiAccessScope, targetId: bigint): string {
    return `${scope}:${targetId.toString()}`;
  }

  async hasAccess(chatId: bigint): Promise<boolean> {
    const grant = this.access.get(chatId.toString());
    return Boolean(grant && grant.expiresAt.getTime() > Date.now());
  }

  async hasUserAccess(telegramUserId: bigint): Promise<boolean> {
    const now = Date.now();
    const personal = this.userAccess.get(telegramUserId.toString());
    // A DM's chat id equals the user id, so a code redeemed in a private chat
    // (stored in `access`) is a personal grant that follows the user.
    const dmGrant = this.access.get(telegramUserId.toString());
    return (
      Boolean(personal && personal.expiresAt.getTime() > now) ||
      Boolean(dmGrant && dmGrant.expiresAt.getTime() > now)
    );
  }

  async generateCode(
    createdByTelegramId: bigint,
    days: number,
    note?: string,
  ): Promise<string> {
    const code = generateAiAccessCodeValue();
    this.seq += 1;
    this.codes.set(hashAiAccessCode(code), {
      seq: this.seq,
      codeHash: hashAiAccessCode(code),
      codePrefix: code.slice(0, 9),
      days,
      note,
      createdByTelegramId,
      createdAt: new Date(),
      redeemedByChatId: undefined,
      redeemedAt: undefined,
    });
    return code;
  }

  async listCodes(limit = 50): Promise<readonly AiAccessCodeRecord[]> {
    return [...this.codes.values()]
      .sort((left, right) => right.seq - left.seq)
      .slice(0, limit)
      .map((row) => ({
        codePrefix: row.codePrefix,
        days: row.days,
        note: row.note,
        createdByTelegramId: row.createdByTelegramId,
        redeemedByChatId: row.redeemedByChatId,
        redeemedAt: row.redeemedAt,
        createdAt: row.createdAt,
      }));
  }

  async redeemCode(
    chatId: bigint,
    code: string,
  ): Promise<RedeemAiAccessCodeResult> {
    const found = this.codes.get(hashAiAccessCode(code));
    if (!found) {
      return { ok: false, reason: "not-found" };
    }
    if (found.redeemedByChatId) {
      return { ok: false, reason: "already-used" };
    }

    found.redeemedByChatId = chatId;
    found.redeemedAt = new Date();
    const expiresAt = daysFromNow(found.days);
    this.access.set(chatId.toString(), {
      expiresAt,
      grantedByCode: found.codePrefix,
    });
    return { ok: true, expiresAt };
  }

  async recordSubscriptionPayment({
    scope,
    targetId,
    telegramUserId,
    chargeId,
    periodEnd,
  }: RecordSubscriptionPaymentInput): Promise<void> {
    this.subscriptions.set(this.subKey(scope, targetId), {
      scope,
      targetId,
      telegramUserId,
      lastChargeId: chargeId,
      currentPeriodEnd: periodEnd,
      canceled: false,
    });
    if (scope === "chat") {
      this.access.set(targetId.toString(), {
        expiresAt: periodEnd,
        grantedByCode: "subscription",
      });
    } else {
      this.userAccess.set(targetId.toString(), { expiresAt: periodEnd });
    }
  }

  async getSubscription(
    scope: AiAccessScope,
    targetId: bigint,
  ): Promise<AiSubscriptionRecord | undefined> {
    return this.subscriptions.get(this.subKey(scope, targetId));
  }

  async cancelSubscription(
    scope: AiAccessScope,
    targetId: bigint,
  ): Promise<CancelSubscriptionResult> {
    const sub = this.subscriptions.get(this.subKey(scope, targetId));
    if (!sub) {
      return { ok: false };
    }
    sub.canceled = true;
    return {
      ok: true,
      telegramUserId: sub.telegramUserId,
      lastChargeId: sub.lastChargeId,
    };
  }
}
