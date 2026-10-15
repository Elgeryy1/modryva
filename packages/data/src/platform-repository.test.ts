import { describe, expect, it } from "vitest";
import {
  generateWebhookSecret,
  hashWebhookSecret,
  InMemoryPlatformRepository,
} from "./platform-repository.js";

describe("InMemoryPlatformRepository", () => {
  it("redeems a promo into one managed bot slot once", async () => {
    const repo = new InMemoryPlatformRepository();
    const promo = await repo.createPromo({
      tenantId: undefined,
      template: "community",
      maxUses: 1,
      expiresAt: undefined,
      note: undefined,
      createdByTelegramId: 1n,
    });

    const first = await repo.redeemPromo({
      code: promo.code,
      redeemedByTelegramId: 42n,
      tenantId: undefined,
    });
    expect(first.ok).toBe(true);
    expect(await repo.availableManagedBotSlots(42n)).toBe(1);

    const second = await repo.redeemPromo({
      code: promo.code,
      redeemedByTelegramId: 42n,
      tenantId: undefined,
    });
    expect(second).toEqual({ ok: false, reason: "used-up" });
  });

  it("consumes a slot when registering a managed bot", async () => {
    const repo = new InMemoryPlatformRepository();
    await repo.grantManagedBotSlot({
      ownerTelegramId: 42n,
      template: "creator",
      expiresAt: undefined,
      createdByTelegramId: 1n,
    });

    const registered = await repo.registerManagedBot({
      ownerTelegramId: 42n,
      botTelegramId: 777n,
      username: "child_bot",
      displayName: "Child Bot",
    });

    expect(registered).toMatchObject({ ok: true, isNew: true });
    expect(await repo.availableManagedBotSlots(42n)).toBe(0);
    expect(await repo.listManagedBots(42n)).toHaveLength(1);

    // One key = one bot: a second registration with no free slot is rejected.
    const secondBot = await repo.registerManagedBot({
      ownerTelegramId: 42n,
      botTelegramId: 888n,
      username: "child_bot_2",
      displayName: "Child Bot 2",
    });
    expect(secondBot).toEqual({ ok: false, reason: "no-slot" });
    expect(await repo.listManagedBots(42n)).toHaveLength(1);
  });

  it("lists and suspends managed bots whose entitlement expired", async () => {
    const repo = new InMemoryPlatformRepository();
    await repo.grantManagedBotSlot({
      ownerTelegramId: 42n,
      template: "creator",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      createdByTelegramId: 1n,
    });
    await repo.registerManagedBot({
      ownerTelegramId: 42n,
      botTelegramId: 777n,
      username: "child_bot",
      displayName: "Child Bot",
    });
    await repo.activateManagedBot({
      botTelegramId: 777n,
      encryptedToken: "enc",
      tokenFingerprint: "fp",
      webhookSecretHash: "h",
    });

    // Before expiry: nothing to switch off.
    expect(
      await repo.listExpiredActiveBots(new Date("2029-01-01T00:00:00.000Z")),
    ).toHaveLength(0);

    // After expiry: the bot is due for suspension.
    const expired = await repo.listExpiredActiveBots(
      new Date("2031-01-01T00:00:00.000Z"),
    );
    expect(expired).toHaveLength(1);
    await repo.suspendManagedBot(expired[0]?.id ?? "", "entitlement expired");
    const bots = await repo.listManagedBots(42n);
    expect(bots[0]?.status).toBe("suspended");
  });

  it("reactivates a suspended bot whose entitlement is active again", async () => {
    const repo = new InMemoryPlatformRepository();
    await repo.grantManagedBotSlot({
      ownerTelegramId: 42n,
      template: "creator",
      expiresAt: undefined,
      createdByTelegramId: 1n,
    });
    await repo.registerManagedBot({
      ownerTelegramId: 42n,
      botTelegramId: 777n,
      username: "child_bot",
      displayName: "Child",
    });
    await repo.activateManagedBot({
      botTelegramId: 777n,
      encryptedToken: "enc-token",
      tokenFingerprint: "fp",
      webhookSecretHash: "h",
    });
    const before = await repo.listManagedBots(42n);
    await repo.suspendManagedBot(before[0]?.id ?? "", "expired");

    // Not the owner → rejected.
    expect(await repo.reactivationInfo("child_bot", 99n)).toEqual({
      ok: false,
      reason: "not-owner",
    });

    const info = await repo.reactivationInfo("child_bot", 42n);
    expect(info.ok).toBe(true);
    if (info.ok) {
      expect(info.token).toBe("enc-token");
      expect(info.consumesSlot).toBe(false); // own entitlement still active
      expect(
        await repo.commitReactivation({
          username: "child_bot",
          ownerTelegramId: 42n,
          secretHash: "newhash",
          entitlementId: info.entitlementId,
          consumesSlot: info.consumesSlot,
        }),
      ).toBe(true);
    }
    const after = await repo.listManagedBots(42n);
    expect(after[0]?.status).toBe("active");
  });

  it("tracks active, expired and revoked platform user bans", async () => {
    const repo = new InMemoryPlatformRepository();

    const ban = await repo.banPlatformUser({
      telegramUserId: 666n,
      reason: "spam",
      bannedByTelegramId: 42n,
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    expect(ban).toMatchObject({
      telegramUserId: 666n,
      reason: "spam",
      bannedByTelegramId: 42n,
      revokedAt: null,
    });
    expect(
      await repo.getActivePlatformUserBan(
        666n,
        new Date("2029-01-01T00:00:00.000Z"),
      ),
    ).toMatchObject({ telegramUserId: 666n, reason: "spam" });
    expect(
      await repo.getActivePlatformUserBan(
        666n,
        new Date("2031-01-01T00:00:00.000Z"),
      ),
    ).toBeNull();

    await repo.banPlatformUser({
      telegramUserId: 777n,
      reason: "abuse",
      bannedByTelegramId: 42n,
      expiresAt: undefined,
    });
    expect(await repo.listPlatformUserBans(1)).toHaveLength(1);
    expect(await repo.revokePlatformUserBan(777n)).toBe(true);
    expect(await repo.getActivePlatformUserBan(777n)).toBeNull();
  });

  it("hashes webhook secrets without storing the raw value", () => {
    const secret = generateWebhookSecret();
    expect(hashWebhookSecret(secret)).toBe(hashWebhookSecret(secret));
    expect(hashWebhookSecret(secret)).not.toContain(secret);
  });
});
