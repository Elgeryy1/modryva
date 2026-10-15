import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export interface ProductRecord {
  readonly productId: string;
  readonly title: string;
  readonly amount: number;
  readonly currency: string;
}

export interface RecordPaymentInput {
  readonly tenantId: string;
  readonly chatId: string;
  readonly telegramUserId: bigint;
  readonly productId: string;
  readonly chargeId: string;
  readonly amount: number;
  readonly currency: string;
}

export interface PaymentRepository {
  upsertProduct(
    tenantId: string,
    chatId: string,
    productId: string,
    title: string,
    amount: number,
    currency: string,
  ): Promise<ProductRecord>;
  listProducts(tenantId: string, limit?: number): Promise<ProductRecord[]>;
  getProduct(
    tenantId: string,
    productId: string,
  ): Promise<ProductRecord | null>;
  createInvoice(input: {
    tenantId: string;
    chatId: string;
    productId: string;
    telegramUserId: bigint;
    payload: string;
    amount: number;
    currency: string;
  }): Promise<void>;
  recordPayment(input: RecordPaymentInput): Promise<{ duplicate: boolean }>;
  revenueTotal(tenantId: string, chatId: string): Promise<number>;
}

const toProduct = (product: {
  productId: string;
  title: string;
  amount: number;
  currency: string;
}): ProductRecord => ({
  productId: product.productId,
  title: product.title,
  amount: product.amount,
  currency: product.currency,
});

export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async upsertProduct(
    tenantId: string,
    chatId: string,
    productId: string,
    title: string,
    amount: number,
    currency: string,
  ): Promise<ProductRecord> {
    const product = await this.client.product.upsert({
      where: { tenantId_productId: { tenantId, productId } },
      create: { tenantId, chatId, productId, title, amount, currency },
      update: { title, amount, currency, active: true },
    });

    return toProduct(product);
  }

  async listProducts(tenantId: string, limit = 25): Promise<ProductRecord[]> {
    const products = await this.client.product.findMany({
      where: { tenantId, active: true },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    return products.map(toProduct);
  }

  async getProduct(
    tenantId: string,
    productId: string,
  ): Promise<ProductRecord | null> {
    const product = await this.client.product.findUnique({
      where: { tenantId_productId: { tenantId, productId } },
    });

    return product?.active ? toProduct(product) : null;
  }

  async createInvoice(input: {
    tenantId: string;
    chatId: string;
    productId: string;
    telegramUserId: bigint;
    payload: string;
    amount: number;
    currency: string;
  }): Promise<void> {
    await this.client.invoice.create({
      data: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        productId: input.productId,
        telegramUserId: input.telegramUserId,
        payload: input.payload,
        amount: input.amount,
        currency: input.currency,
      },
    });
  }

  /**
   * Records a successful payment, keyed on the Telegram charge id. A duplicate
   * `successful_payment` (retries, reprocessing) collapses to `{ duplicate: true }`
   * so the ledger never double-counts revenue.
   */
  async recordPayment(
    input: RecordPaymentInput,
  ): Promise<{ duplicate: boolean }> {
    try {
      await this.client.payment.create({
        data: {
          tenantId: input.tenantId,
          chatId: input.chatId,
          telegramUserId: input.telegramUserId,
          productId: input.productId,
          chargeId: input.chargeId,
          amount: input.amount,
          currency: input.currency,
        },
      });
      return { duplicate: false };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return { duplicate: true };
      }
      throw error;
    }
  }

  async revenueTotal(tenantId: string, chatId: string): Promise<number> {
    const result = await this.client.payment.aggregate({
      where: { tenantId, chatId },
      _sum: { amount: true },
    });

    return result._sum.amount ?? 0;
  }
}
