import { describe, expect, it } from "vitest";
import {
  generateAiAccessCodeValue,
  InMemoryAiAccessRepository,
} from "./ai-access-repository.js";

describe("AiAccessRepository", () => {
  it("reports no access for a chat that never redeemed a code", async () => {
    const repo = new InMemoryAiAccessRepository();
    expect(await repo.hasAccess(-100n)).toBe(false);
  });

  it("generates a code in the AI-XXXXXX-XXXXXX shape", async () => {
    const repo = new InMemoryAiAccessRepository();
    const code = await repo.generateCode(42n, 30);
    expect(code).toMatch(/^AI-[A-Z0-9_-]{6}-[A-Z0-9_-]{6}$/u);
  });

  it("redeems a valid code and grants access to that chat", async () => {
    const repo = new InMemoryAiAccessRepository();
    const code = await repo.generateCode(42n, 30, "grupo de prueba");
    const result = await repo.redeemCode(-100n, code);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.expiresAt).toBeInstanceOf(Date);
    }
    expect(await repo.hasAccess(-100n)).toBe(true);
  });

  it("does not grant access to a DIFFERENT chat than the one that redeemed", async () => {
    const repo = new InMemoryAiAccessRepository();
    const code = await repo.generateCode(42n, 30);
    await repo.redeemCode(-100n, code);

    expect(await repo.hasAccess(-200n)).toBe(false);
  });

  it("lets a code redeemed in a DM follow the user (personal grant)", async () => {
    const repo = new InMemoryAiAccessRepository();
    const code = await repo.generateCode(42n, 30);
    // In a DM the chat id equals the user id.
    await repo.redeemCode(7n, code);

    // The grant follows that user everywhere via hasUserAccess…
    expect(await repo.hasUserAccess(7n)).toBe(true);
    // …but never leaks to a different user.
    expect(await repo.hasUserAccess(8n)).toBe(false);
  });

  it("rejects redeeming a code that was already used", async () => {
    const repo = new InMemoryAiAccessRepository();
    const code = await repo.generateCode(42n, 30);
    await repo.redeemCode(-100n, code);

    const second = await repo.redeemCode(-200n, code);
    expect(second).toEqual({ ok: false, reason: "already-used" });
  });

  it("rejects redeeming a code that does not exist", async () => {
    const repo = new InMemoryAiAccessRepository();
    const result = await repo.redeemCode(-100n, "AI-000000-000000");
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });

  it("is case-insensitive and trims whitespace when redeeming", async () => {
    const repo = new InMemoryAiAccessRepository();
    const code = await repo.generateCode(42n, 30);
    const result = await repo.redeemCode(-100n, `  ${code.toLowerCase()}  `);
    expect(result.ok).toBe(true);
  });

  it("sets expiresAt roughly `days` days in the future", async () => {
    const repo = new InMemoryAiAccessRepository();
    const code = await repo.generateCode(42n, 7);
    const result = await repo.redeemCode(-100n, code);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const expectedMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
      const diff = Math.abs(result.expiresAt.getTime() - expectedMs);
      expect(diff).toBeLessThan(5_000);
    }
  });

  it("lists generated codes, most recent first", async () => {
    const repo = new InMemoryAiAccessRepository();
    await repo.generateCode(42n, 30, "first");
    await repo.generateCode(42n, 30, "second");
    const codes = await repo.listCodes();
    expect(codes).toHaveLength(2);
    expect(codes[0]?.note).toBe("second");
    expect(codes[1]?.note).toBe("first");
  });

  it("marks a listed code as redeemed once used", async () => {
    const repo = new InMemoryAiAccessRepository();
    const code = await repo.generateCode(42n, 30);
    await repo.redeemCode(-100n, code);
    const [entry] = await repo.listCodes();
    expect(entry?.redeemedByChatId).toBe(-100n);
    expect(entry?.redeemedAt).toBeInstanceOf(Date);
  });
});

describe("generateAiAccessCodeValue", () => {
  it("produces unique codes", () => {
    const codes = new Set(
      Array.from({ length: 20 }, () => generateAiAccessCodeValue()),
    );
    expect(codes.size).toBe(20);
  });
});

describe("AI pack subscriptions (chat scope)", () => {
  it("grants chat access on the initial payment", async () => {
    const repo = new InMemoryAiAccessRepository();
    const periodEnd = new Date(Date.now() + 30 * 86_400_000);
    await repo.recordSubscriptionPayment({
      scope: "chat",
      targetId: -100n,
      telegramUserId: 42n,
      chargeId: "charge_1",
      periodEnd,
    });

    expect(await repo.hasAccess(-100n)).toBe(true);
    const sub = await repo.getSubscription("chat", -100n);
    expect(sub?.lastChargeId).toBe("charge_1");
    expect(sub?.canceled).toBe(false);
  });

  it("extends access on a renewal payment (new charge id)", async () => {
    const repo = new InMemoryAiAccessRepository();
    await repo.recordSubscriptionPayment({
      scope: "chat",
      targetId: -100n,
      telegramUserId: 42n,
      chargeId: "charge_1",
      periodEnd: new Date(Date.now() + 30 * 86_400_000),
    });
    const renewedUntil = new Date(Date.now() + 60 * 86_400_000);
    await repo.recordSubscriptionPayment({
      scope: "chat",
      targetId: -100n,
      telegramUserId: 42n,
      chargeId: "charge_2",
      periodEnd: renewedUntil,
    });

    const sub = await repo.getSubscription("chat", -100n);
    expect(sub?.lastChargeId).toBe("charge_2");
    expect(sub?.currentPeriodEnd).toEqual(renewedUntil);
  });

  it("does not grant access to a different chat", async () => {
    const repo = new InMemoryAiAccessRepository();
    await repo.recordSubscriptionPayment({
      scope: "chat",
      targetId: -100n,
      telegramUserId: 42n,
      chargeId: "charge_1",
      periodEnd: new Date(Date.now() + 30 * 86_400_000),
    });
    expect(await repo.hasAccess(-200n)).toBe(false);
  });

  it("cancelSubscription marks it canceled and returns the charge id for editUserStarSubscription", async () => {
    const repo = new InMemoryAiAccessRepository();
    await repo.recordSubscriptionPayment({
      scope: "chat",
      targetId: -100n,
      telegramUserId: 42n,
      chargeId: "charge_1",
      periodEnd: new Date(Date.now() + 30 * 86_400_000),
    });

    const result = await repo.cancelSubscription("chat", -100n);
    expect(result).toEqual({
      ok: true,
      telegramUserId: 42n,
      lastChargeId: "charge_1",
    });

    const sub = await repo.getSubscription("chat", -100n);
    expect(sub?.canceled).toBe(true);
    // Cancelling does not revoke the already-paid-for period.
    expect(await repo.hasAccess(-100n)).toBe(true);
  });

  it("cancelSubscription on a non-existent subscription returns ok:false", async () => {
    const repo = new InMemoryAiAccessRepository();
    expect(await repo.cancelSubscription("chat", -999n)).toEqual({
      ok: false,
    });
  });
});

describe("AI pack subscriptions (personal scope)", () => {
  it("grants personal access to the paying user, not a chat", async () => {
    const repo = new InMemoryAiAccessRepository();
    await repo.recordSubscriptionPayment({
      scope: "user",
      targetId: 7n,
      telegramUserId: 7n,
      chargeId: "charge_1",
      periodEnd: new Date(Date.now() + 30 * 86_400_000),
    });

    expect(await repo.hasUserAccess(7n)).toBe(true);
    expect(await repo.hasUserAccess(8n)).toBe(false);
    expect(await repo.hasAccess(7n)).toBe(false);
  });
});
