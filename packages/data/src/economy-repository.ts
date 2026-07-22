import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * Economia virtual sana (motor #8): carteras de puntos SIN valor monetario por
 * chat + usuario. La logica pura (ganancia con cupo, caducidad, temporadas) vive
 * en @superbot/module-games (economy); aqui solo esta la persistencia del saldo
 * y del timestamp de ultima ganancia, scoped por tenant + chat + usuario.
 */

/** Estado persistido de una cartera. `lastEarnedMs` es epoch en ms. */
export interface EconomyWalletState {
  readonly balance: number;
  readonly lastEarnedMs: number;
}

export interface EconomyRepository {
  getWallet(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
  ): Promise<EconomyWalletState | null>;
  setWallet(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    state: EconomyWalletState,
  ): Promise<void>;
}

export class PrismaEconomyRepository implements EconomyRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async getWallet(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
  ): Promise<EconomyWalletState | null> {
    const wallet = await this.client.economyWallet.findUnique({
      where: {
        tenantId_chatId_userTelegramId: { tenantId, chatId, userTelegramId },
      },
    });
    if (!wallet) {
      return null;
    }
    return {
      balance: wallet.balance,
      lastEarnedMs: Number(wallet.lastEarnedMs),
    };
  }

  async setWallet(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    state: EconomyWalletState,
  ): Promise<void> {
    const lastEarnedMs = BigInt(Math.trunc(state.lastEarnedMs));
    await this.client.economyWallet.upsert({
      where: {
        tenantId_chatId_userTelegramId: { tenantId, chatId, userTelegramId },
      },
      create: {
        tenantId,
        chatId,
        userTelegramId,
        balance: state.balance,
        lastEarnedMs,
      },
      update: { balance: state.balance, lastEarnedMs },
    });
  }
}

/** Store en memoria usado como default del constructor (tests). */
export class InMemoryEconomyRepository implements EconomyRepository {
  private wallets = new Map<string, EconomyWalletState>();

  private key(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
  ): string {
    return `${tenantId}:${chatId}:${userTelegramId.toString()}`;
  }

  async getWallet(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
  ): Promise<EconomyWalletState | null> {
    return this.wallets.get(this.key(tenantId, chatId, userTelegramId)) ?? null;
  }

  async setWallet(
    tenantId: string,
    chatId: string,
    userTelegramId: bigint,
    state: EconomyWalletState,
  ): Promise<void> {
    this.wallets.set(this.key(tenantId, chatId, userTelegramId), {
      balance: state.balance,
      lastEarnedMs: state.lastEarnedMs,
    });
  }
}
