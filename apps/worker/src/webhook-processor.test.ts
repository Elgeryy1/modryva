import type {
  WebhookDeliveryRecord,
  WebhookRecord,
  WebhookRepository,
} from "@superbot/data";
import { verifyWebhookSignature } from "@superbot/module-automation";
import { describe, expect, it } from "vitest";
import { processWebhookDeliveries } from "./webhook-processor.js";

class FakeWebhookRepository implements WebhookRepository {
  delivered: string[] = [];
  failed: string[] = [];

  constructor(private readonly due: WebhookDeliveryRecord[] = []) {}

  async addWebhook(): Promise<WebhookRecord> {
    throw new Error("not used");
  }
  async listWebhooks(): Promise<WebhookRecord[]> {
    return [];
  }
  async removeWebhook(): Promise<boolean> {
    return false;
  }
  async enqueueDelivery(): Promise<void> {}
  async listDueDeliveries(): Promise<WebhookDeliveryRecord[]> {
    return this.due;
  }
  async markDelivered(id: string): Promise<void> {
    this.delivered.push(id);
  }
  async markFailed(id: string): Promise<void> {
    this.failed.push(id);
  }
}

describe("processWebhookDeliveries", () => {
  it("posts a signed body and marks delivered on 2xx", async () => {
    const body = JSON.stringify({ event: "ping", payload: {} });
    const repo = new FakeWebhookRepository([
      {
        id: "d1",
        url: "https://example.com/hook",
        secret: "shh",
        event: "ping",
        body,
      },
    ]);
    let receivedSignature = "";
    let receivedBody = "";

    const summary = await processWebhookDeliveries({
      webhooks: repo,
      fetcher: async (_url, init) => {
        receivedSignature = init.headers["x-superbot-signature"] ?? "";
        receivedBody = init.body;
        return { ok: true, status: 200 };
      },
    });

    expect(repo.delivered).toEqual(["d1"]);
    expect(summary).toEqual({ processed: 1, delivered: 1, failed: 0 });
    // The receiver can verify the signature over the exact delivered body.
    expect(verifyWebhookSignature(receivedBody, "shh", receivedSignature)).toBe(
      true,
    );
  });

  it("marks failed on non-2xx and isolates errors", async () => {
    const repo = new FakeWebhookRepository([
      { id: "d1", url: "https://a", secret: "s", event: "e", body: "{}" },
      { id: "d2", url: "https://b", secret: "s", event: "e", body: "{}" },
    ]);

    const summary = await processWebhookDeliveries({
      webhooks: repo,
      fetcher: async (url) => {
        if (url === "https://a") {
          throw new Error("network");
        }
        return { ok: false, status: 500 };
      },
    });

    expect(repo.failed.sort()).toEqual(["d1", "d2"]);
    expect(summary).toEqual({ processed: 2, delivered: 0, failed: 2 });
  });
});
