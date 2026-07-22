import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export interface WebhookRecord {
  readonly id: string;
  readonly url: string;
}

export interface WebhookDeliveryRecord {
  readonly id: string;
  readonly url: string;
  readonly secret: string;
  readonly event: string;
  readonly body: string;
}

export interface WebhookRepository {
  addWebhook(
    tenantId: string,
    chatId: string,
    url: string,
    secret: string,
    createdBy: string | undefined,
  ): Promise<WebhookRecord>;
  listWebhooks(chatId: string, limit?: number): Promise<WebhookRecord[]>;
  removeWebhook(chatId: string, webhookId: string): Promise<boolean>;
  enqueueDelivery(input: {
    tenantId: string;
    webhookId: string;
    url: string;
    secret: string;
    event: string;
    body: string;
  }): Promise<void>;
  listDueDeliveries(limit?: number): Promise<WebhookDeliveryRecord[]>;
  markDelivered(id: string): Promise<void>;
  markFailed(id: string): Promise<void>;
}

export class PrismaWebhookRepository implements WebhookRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async addWebhook(
    tenantId: string,
    chatId: string,
    url: string,
    secret: string,
    createdBy: string | undefined,
  ): Promise<WebhookRecord> {
    const webhook = await this.client.webhook.create({
      data: {
        tenantId,
        chatId,
        url,
        secret,
        ...(createdBy ? { createdBy } : {}),
      },
    });
    return { id: webhook.id, url: webhook.url };
  }

  async listWebhooks(chatId: string, limit = 20): Promise<WebhookRecord[]> {
    const webhooks = await this.client.webhook.findMany({
      where: { chatId, active: true },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    return webhooks.map((webhook) => ({ id: webhook.id, url: webhook.url }));
  }

  async removeWebhook(chatId: string, webhookId: string): Promise<boolean> {
    const result = await this.client.webhook.deleteMany({
      where: { id: webhookId, chatId },
    });
    return result.count > 0;
  }

  async enqueueDelivery(input: {
    tenantId: string;
    webhookId: string;
    url: string;
    secret: string;
    event: string;
    body: string;
  }): Promise<void> {
    await this.client.webhookDelivery.create({
      data: {
        tenantId: input.tenantId,
        webhookId: input.webhookId,
        url: input.url,
        secret: input.secret,
        event: input.event,
        body: input.body,
      },
    });
  }

  async listDueDeliveries(limit = 50): Promise<WebhookDeliveryRecord[]> {
    const deliveries = await this.client.webhookDelivery.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    return deliveries.map((delivery) => ({
      id: delivery.id,
      url: delivery.url,
      secret: delivery.secret,
      event: delivery.event,
      body: delivery.body,
    }));
  }

  async markDelivered(id: string): Promise<void> {
    await this.client.webhookDelivery.update({
      where: { id },
      data: { status: "delivered", deliveredAt: new Date() },
    });
  }

  async markFailed(id: string): Promise<void> {
    await this.client.webhookDelivery.update({
      where: { id },
      data: { status: "failed", attempts: { increment: 1 } },
    });
  }
}
