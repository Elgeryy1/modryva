import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  InMemoryEntitlementRepository,
  PrismaEntitlementRepository,
} from "./entitlement-repository.js";

describe("EntitlementRepository", () => {
  it("returns the free default when no entitlement row exists", async () => {
    const repo = new InMemoryEntitlementRepository();
    const entitlement = await repo.getEntitlement("fed_1");
    expect(entitlement).toEqual({
      plan: "free",
      maxChats: 3,
      premiumUntil: null,
      grantedByCode: null,
    });
  });

  it("generates a code that is hard to guess", async () => {
    const repo = new InMemoryEntitlementRepository();
    const code = await repo.generateCode("owner_1", "pro", 10, 30);
    expect(code.length).toBeGreaterThanOrEqual(20);
    expect(code).not.toContain("-");
  });

  it("redeems a valid code and upgrades the fed's entitlement", async () => {
    const repo = new InMemoryEntitlementRepository();
    const code = await repo.generateCode("owner_1", "pro", 10, 30);
    const result = await repo.redeemCode("fed_1", code, "user_1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entitlement.plan).toBe("pro");
      expect(result.entitlement.maxChats).toBe(10);
      expect(result.entitlement.grantedByCode).toBe(code);
      expect(result.entitlement.premiumUntil).toBeInstanceOf(Date);
    }

    const stored = await repo.getEntitlement("fed_1");
    expect(stored.plan).toBe("pro");
  });

  it("rejects redeeming a code that was already used", async () => {
    const repo = new InMemoryEntitlementRepository();
    const code = await repo.generateCode("owner_1", "pro", 10, 30);
    await repo.redeemCode("fed_1", code, "user_1");

    const second = await repo.redeemCode("fed_2", code, "user_2");
    expect(second).toEqual({ ok: false, reason: "already-used" });
  });

  it("rejects redeeming a code that does not exist", async () => {
    const repo = new InMemoryEntitlementRepository();
    const result = await repo.redeemCode("fed_1", "no-such-code", "user_1");
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });

  it("sets premiumUntil roughly `days` days in the future", async () => {
    const repo = new InMemoryEntitlementRepository();
    const code = await repo.generateCode("owner_1", "pro", 10, 7);
    const result = await repo.redeemCode("fed_1", code, "user_1");
    expect(result.ok).toBe(true);
    if (result.ok && result.entitlement.premiumUntil) {
      const expectedMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
      const diff = Math.abs(
        result.entitlement.premiumUntil.getTime() - expectedMs,
      );
      expect(diff).toBeLessThan(5_000);
    }
  });

  it("reports over the chat limit when the count exceeds maxChats", async () => {
    const repo = new InMemoryEntitlementRepository();
    const overLimit = await repo.isOverChatLimit("fed_1", 4);
    expect(overLimit).toBe(true);
  });

  it("reports within the chat limit when the count is at or below maxChats", async () => {
    const repo = new InMemoryEntitlementRepository();
    const atLimit = await repo.isOverChatLimit("fed_1", 3);
    expect(atLimit).toBe(false);
  });

  it("uses the upgraded maxChats once a code is redeemed", async () => {
    const repo = new InMemoryEntitlementRepository();
    const code = await repo.generateCode("owner_1", "pro", 10, 30);
    await repo.redeemCode("fed_1", code, "user_1");
    expect(await repo.isOverChatLimit("fed_1", 5)).toBe(false);
    expect(await repo.isOverChatLimit("fed_1", 11)).toBe(true);
  });
});

describe("PrismaEntitlementRepository.redeemCode concurrency guard", () => {
  it("does NOT grant an entitlement when the atomic claim loses the race (updateMany matched 0 rows)", async () => {
    // Model the lost half of a concurrent double-redeem: findUnique still sees
    // redeemedBy === null (both racers read the pre-commit snapshot), but the
    // guarded updateMany matches 0 rows because the other transaction already
    // committed the claim. The repo MUST refuse — never upsert an entitlement.
    // Before the fix (a plain, unguarded `update`) it fell through to the upsert
    // and granted the premium a second time; this test would then fail because
    // `ok` is true and `upsert` was called.
    let upsertCalls = 0;
    const tx = {
      ownerNetworkPremiumCode: {
        findUnique: async () => ({
          code: "CODE",
          plan: "pro",
          maxChats: 10,
          days: 30,
          redeemedBy: null,
        }),
        // Present so a pre-fix (unguarded) update() path is still callable —
        // the point is that the fixed code must use the GUARDED updateMany.
        update: async () => ({}),
        updateMany: async () => ({ count: 0 }),
      },
      ownerNetworkEntitlement: {
        upsert: async () => {
          upsertCalls += 1;
          return {
            plan: "pro",
            maxChats: 10,
            premiumUntil: new Date(),
            grantedByCode: "CODE",
          };
        },
      },
    };
    const fakeClient = {
      $transaction: async <T>(fn: (t: typeof tx) => Promise<T>): Promise<T> =>
        fn(tx),
    } as unknown as PrismaClient;

    const repo = new PrismaEntitlementRepository(fakeClient);
    const result = await repo.redeemCode("fed_1", "CODE", "user_2");

    expect(result).toEqual({ ok: false, reason: "already-used" });
    expect(upsertCalls).toBe(0);
  });

  it("grants the entitlement when the atomic claim wins (updateMany matched 1 row)", async () => {
    let upsertCalls = 0;
    const tx = {
      ownerNetworkPremiumCode: {
        findUnique: async () => ({
          code: "CODE",
          plan: "pro",
          maxChats: 10,
          days: 30,
          redeemedBy: null,
        }),
        update: async () => ({}),
        updateMany: async () => ({ count: 1 }),
      },
      ownerNetworkEntitlement: {
        upsert: async () => {
          upsertCalls += 1;
          return {
            plan: "pro",
            maxChats: 10,
            premiumUntil: new Date(),
            grantedByCode: "CODE",
          };
        },
      },
    };
    const fakeClient = {
      $transaction: async <T>(fn: (t: typeof tx) => Promise<T>): Promise<T> =>
        fn(tx),
    } as unknown as PrismaClient;

    const repo = new PrismaEntitlementRepository(fakeClient);
    const result = await repo.redeemCode("fed_1", "CODE", "user_1");

    expect(result.ok).toBe(true);
    expect(upsertCalls).toBe(1);
  });
});
