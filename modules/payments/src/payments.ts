import type { TelegramUpdateEnvelope } from "@superbot/domain";

export type PaymentCommand =
  | { readonly kind: "list" }
  | { readonly kind: "buy"; readonly productId: string }
  | {
      readonly kind: "add";
      readonly productId: string;
      readonly amount: number;
      readonly title: string;
    };

export interface PaymentCommandError {
  readonly code: "product-required" | "format";
  readonly usage: string;
}

export type PaymentCommandResult =
  | { readonly ok: true; readonly command: PaymentCommand }
  | { readonly ok: false; readonly error: PaymentCommandError };

const paymentCommandNames: ReadonlySet<string> = new Set([
  "products",
  "buy",
  "addproduct",
]);

/** A Telegram Stars product id: lowercase slug, 2-32 chars. */
const PRODUCT_ID_PATTERN = /^[a-z0-9_-]{2,32}$/u;

export const parsePaymentCommand = (
  update: TelegramUpdateEnvelope,
): PaymentCommandResult | null => {
  const name = update.command?.name;

  if (!name || !paymentCommandNames.has(name)) {
    return null;
  }

  const args = update.command?.args ?? [];

  if (name === "products") {
    return { ok: true, command: { kind: "list" } };
  }

  if (name === "buy") {
    const productId = (args[0] ?? "").toLowerCase();
    if (!PRODUCT_ID_PATTERN.test(productId)) {
      return {
        ok: false,
        error: { code: "product-required", usage: "Uso: /buy <producto>" },
      };
    }
    return { ok: true, command: { kind: "buy", productId } };
  }

  const productId = (args[0] ?? "").toLowerCase();
  const amount = Number.parseInt(args[1] ?? "", 10);
  const title = args.slice(2).join(" ").trim();

  if (
    !PRODUCT_ID_PATTERN.test(productId) ||
    !Number.isInteger(amount) ||
    amount < 1 ||
    amount > 100_000 ||
    title.length === 0
  ) {
    return {
      ok: false,
      error: {
        code: "format",
        usage: "Uso: /addproduct <id> <precio_stars> <titulo>",
      },
    };
  }

  return { ok: true, command: { kind: "add", productId, amount, title } };
};

/** Builds the invoice payload that links a Telegram payment back to a product. */
export const buildInvoicePayload = (
  productId: string,
  telegramUserId: bigint,
): string => `product:${productId}:${telegramUserId.toString()}`;

export interface ParsedPayload {
  readonly productId: string;
  readonly telegramUserId: bigint;
}

export const parseInvoicePayload = (payload: string): ParsedPayload | null => {
  const parts = payload.split(":");
  if (parts.length !== 3 || parts[0] !== "product") {
    return null;
  }
  const productId = parts[1] ?? "";
  const rawUser = parts[2] ?? "";
  if (!PRODUCT_ID_PATTERN.test(productId) || !/^\d+$/u.test(rawUser)) {
    return null;
  }
  return { productId, telegramUserId: BigInt(rawUser) };
};
