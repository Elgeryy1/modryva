import type { WebhookRepository } from "@superbot/data";
import { signWebhook } from "@superbot/module-automation";

export type WebhookFetcher = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  },
) => Promise<{ ok: boolean; status: number }>;

export interface WebhookContext {
  readonly webhooks: WebhookRepository;
  readonly fetcher: WebhookFetcher;
}

export interface WebhookSummary {
  readonly processed: number;
  readonly delivered: number;
  readonly failed: number;
}

/**
 * webhook.deliver.due — drains pending webhook deliveries, POSTing each signed
 * body to its target URL. Each delivery is isolated: a failing endpoint is marked
 * failed and never blocks the others.
 */
export const processWebhookDeliveries = async (
  context: WebhookContext,
): Promise<WebhookSummary> => {
  const due = await context.webhooks.listDueDeliveries();
  let delivered = 0;
  let failed = 0;

  for (const delivery of due) {
    try {
      const signature = signWebhook(delivery.body, delivery.secret);
      const response = await context.fetcher(delivery.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-superbot-event": delivery.event,
          "x-superbot-signature": signature,
        },
        body: delivery.body,
      });
      if (response.ok) {
        delivered += 1;
        await context.webhooks.markDelivered(delivery.id);
      } else {
        failed += 1;
        await context.webhooks.markFailed(delivery.id);
      }
    } catch {
      failed += 1;
      await context.webhooks.markFailed(delivery.id);
    }
  }

  return { processed: due.length, delivered, failed };
};
