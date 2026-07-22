import { describe, expect, it } from "vitest";
import { canPurchaseCosmetic, describeCosmeticKind } from "./cosmetic-shop.js";

describe("canPurchaseCosmetic", () => {
  it("allows a purchase within budget and subtracts the price", () => {
    expect(canPurchaseCosmetic({ balance: 100, price: 30 })).toEqual({
      affordable: true,
      remaining: 70,
    });
  });

  it("allows a purchase that spends the exact balance", () => {
    expect(canPurchaseCosmetic({ balance: 100, price: 100 })).toEqual({
      affordable: true,
      remaining: 0,
    });
  });

  it("rejects a purchase above budget and keeps the balance", () => {
    expect(canPurchaseCosmetic({ balance: 100, price: 150 })).toEqual({
      affordable: false,
      remaining: 100,
    });
  });

  it("treats a free item on a zero balance as affordable", () => {
    expect(canPurchaseCosmetic({ balance: 0, price: 0 })).toEqual({
      affordable: true,
      remaining: 0,
    });
  });

  it("rejects a negative price without touching the balance", () => {
    expect(canPurchaseCosmetic({ balance: 50, price: -10 })).toEqual({
      affordable: false,
      remaining: 50,
    });
  });

  it("rejects a non-finite balance and falls back to zero remaining", () => {
    expect(canPurchaseCosmetic({ balance: Number.NaN, price: 10 })).toEqual({
      affordable: false,
      remaining: 0,
    });
  });

  it("rejects a non-finite price and keeps the balance", () => {
    expect(
      canPurchaseCosmetic({ balance: 40, price: Number.POSITIVE_INFINITY }),
    ).toEqual({
      affordable: false,
      remaining: 40,
    });
  });

  it("is deterministic across repeated calls with the same input", () => {
    const input = { balance: 250, price: 75 } as const;
    const first = canPurchaseCosmetic(input);
    const second = canPurchaseCosmetic(input);
    expect(first).toEqual(second);
    expect(first).toEqual({ affordable: true, remaining: 175 });
  });
});

describe("describeCosmeticKind", () => {
  it("labels a frame", () => {
    expect(describeCosmeticKind("marco")).toBe("Marco");
  });

  it("labels a title with the correct accent", () => {
    expect(describeCosmeticKind("titulo")).toBe("Título");
  });

  it("labels a badge", () => {
    expect(describeCosmeticKind("insignia")).toBe("Insignia");
  });
});
