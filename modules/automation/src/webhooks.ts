import { createHmac, timingSafeEqual } from "node:crypto";
import type { TelegramUpdateEnvelope } from "@superbot/domain";

export type WebhookCommand =
  | { readonly kind: "add"; readonly url: string }
  | { readonly kind: "list" }
  | { readonly kind: "remove"; readonly webhookId: string };

export interface WebhookCommandError {
  readonly code: "url-required" | "url-invalid" | "id-required" | "usage";
  readonly usage: string;
}

export type WebhookCommandResult =
  | { readonly ok: true; readonly command: WebhookCommand }
  | { readonly ok: false; readonly error: WebhookCommandError };

const webhookUsage =
  "Uso: /webhook add <url> | /webhook list | /webhook remove <id>";

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export const parseWebhookCommand = (
  update: TelegramUpdateEnvelope,
): WebhookCommandResult | null => {
  if (update.command?.name !== "webhook") {
    return null;
  }

  const args = update.command?.args ?? [];
  const sub = (args[0] ?? "").toLowerCase();

  if (sub === "list") {
    return { ok: true, command: { kind: "list" } };
  }

  if (sub === "remove") {
    const webhookId = args[1];
    return webhookId
      ? { ok: true, command: { kind: "remove", webhookId } }
      : {
          ok: false,
          error: { code: "id-required", usage: "Uso: /webhook remove <id>" },
        };
  }

  if (sub === "add") {
    const url = args[1];
    if (!url) {
      return {
        ok: false,
        error: { code: "url-required", usage: "Uso: /webhook add <url>" },
      };
    }
    if (!isHttpUrl(url)) {
      return {
        ok: false,
        error: { code: "url-invalid", usage: "La URL debe ser http(s)." },
      };
    }
    return { ok: true, command: { kind: "add", url } };
  }

  return { ok: false, error: { code: "usage", usage: webhookUsage } };
};

/**
 * Builds a deterministic JSON payload for an outgoing webhook delivery. The
 * `sentAt` field is derived purely from `atMs`, so the same inputs always yield
 * the same body (important for stable signatures).
 */
export const buildWebhookBody = (
  event: string,
  payload: Record<string, unknown>,
  atMs: number,
): string =>
  JSON.stringify({
    event,
    sentAt: new Date(atMs).toISOString(),
    payload,
  });

/**
 * Computes the hex-encoded HMAC-SHA256 signature of a webhook body using the
 * shared secret. Receivers recompute this over the raw body to authenticate it.
 */
export const signWebhook = (body: string, secret: string): string =>
  createHmac("sha256", secret).update(body).digest("hex");

/**
 * Verifies that `signature` matches the HMAC-SHA256 of `body` under `secret`.
 * Uses a constant-time comparison to avoid leaking timing information, and
 * returns false (rather than throwing) for malformed or tampered signatures.
 */
export const verifyWebhookSignature = (
  body: string,
  secret: string,
  signature: string,
): boolean => {
  const expected = signWebhook(body, secret);
  const expectedBuffer = Buffer.from(expected, "hex");
  const providedBuffer = Buffer.from(signature, "hex");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
};
