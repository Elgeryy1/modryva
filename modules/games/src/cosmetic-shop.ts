/**
 * Kinds of virtual cosmetics sold in the shop: frames, titles and badges.
 * Values are ASCII slugs used as stable identifiers. Pure and deterministic.
 */
export type CosmeticKind = "marco" | "titulo" | "insignia";

/**
 * Input for a cosmetic purchase check: the buyer chip balance and the item price.
 * Both are plain numbers denominated in the same virtual currency.
 * Pure and deterministic.
 */
export interface CosmeticPurchaseInput {
  readonly balance: number;
  readonly price: number;
}

/**
 * Outcome of a cosmetic purchase check.
 * affordable is true only when the price is valid and covered by the balance.
 * remaining is the balance left after buying, or the untouched balance when not affordable.
 * Pure and deterministic.
 */
export interface CosmeticPurchaseResult {
  readonly affordable: boolean;
  readonly remaining: number;
}

const SAFE_BALANCE = 0;

/**
 * Checks whether a buyer can afford a cosmetic item.
 * Affordable requires finite numbers, a non-negative price, and balance >= price.
 * When affordable, remaining is balance - price; otherwise the balance is returned
 * unchanged (falling back to 0 if the balance is not a finite number).
 * Pure and deterministic.
 */
export const canPurchaseCosmetic = (
  input: CosmeticPurchaseInput,
): CosmeticPurchaseResult => {
  const { balance, price } = input;
  const balanceOk = Number.isFinite(balance);
  const priceOk = Number.isFinite(price) && price >= 0;
  const affordable = balanceOk && priceOk && balance >= price;
  if (affordable) {
    return { affordable: true, remaining: balance - price };
  }
  return { affordable: false, remaining: balanceOk ? balance : SAFE_BALANCE };
};

const COSMETIC_LABELS: Readonly<Record<CosmeticKind, string>> = {
  marco: "Marco",
  titulo: "Título",
  insignia: "Insignia",
};

/**
 * Returns the Spanish user-facing label for a cosmetic kind (e.g. "Título").
 * Pure and deterministic.
 */
export const describeCosmeticKind = (kind: CosmeticKind): string => {
  return COSMETIC_LABELS[kind] ?? "Cosmético";
};
