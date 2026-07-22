import type { PrismaClient } from "@prisma/client";
import { EntitlementKind, ManagedBotStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { PrismaPlatformRepository } from "./platform-repository.js";

interface FakeManagedBot {
  id: string;
  tenantId: string;
  telegramBotId: bigint;
  username: string;
  displayName: string;
  ownerTelegramId: bigint;
  template: string;
  status: ManagedBotStatus;
  entitlementId: string | null;
  plan: string;
  lastError: string | null;
}

interface FakeEntitlement {
  id: string;
  ownerTelegramId: bigint;
  kind: EntitlementKind;
  template: string;
  quantity: number;
  usedQuantity: number;
  source: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

interface FindManyWhere {
  ownerTelegramId: bigint;
  kind: EntitlementKind;
  revokedAt: null;
}

interface UpdateManyWhere {
  id: string;
  revokedAt?: null;
  usedQuantity?: { lt?: number; gt?: number };
}

class FakePrismaClient {
  managedBots = new Map<string, FakeManagedBot>();
  entitlements = new Map<string, FakeEntitlement>();
  tenants = new Map<string, { id: string; slug: string; name: string }>();
  private counter = 1;

  nextId(prefix: string): string {
    return `${prefix}_${this.counter++}`;
  }

  seedManagedBot(bot: FakeManagedBot): void {
    this.managedBots.set(bot.id, bot);
  }

  seedEntitlement(entitlement: FakeEntitlement): void {
    this.entitlements.set(entitlement.id, entitlement);
  }

  managedBot = {
    findFirst: async ({
      where,
    }: {
      where: { OR: Array<Record<string, unknown>> };
    }) => {
      const bots = [...this.managedBots.values()];
      return (
        bots.find((bot) =>
          where.OR.some((cond) =>
            Object.entries(cond).every(
              ([key, value]) =>
                (bot as unknown as Record<string, unknown>)[key] === value,
            ),
          ),
        ) ?? null
      );
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<FakeManagedBot>;
    }) => {
      const bot = this.managedBots.get(where.id);
      if (!bot) throw new Error(`fake managedBot ${where.id} not found`);
      Object.assign(bot, data);
      return bot;
    },
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { username: string };
      create: Omit<FakeManagedBot, "id">;
      update: Partial<FakeManagedBot>;
    }) => {
      const existing = [...this.managedBots.values()].find(
        (bot) => bot.username === where.username,
      );
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const id = this.nextId("bot");
      const created: FakeManagedBot = { id, ...create };
      this.managedBots.set(id, created);
      return created;
    },
  };

  entitlement = {
    findMany: async ({ where }: { where: FindManyWhere }) =>
      [...this.entitlements.values()]
        .filter(
          (entry) =>
            entry.ownerTelegramId === where.ownerTelegramId &&
            entry.kind === where.kind &&
            entry.revokedAt === null,
        )
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.entitlements.get(where.id) ?? null,
    updateMany: async ({
      where,
      data,
    }: {
      where: UpdateManyWhere;
      data: {
        usedQuantity?: { increment?: number; decrement?: number };
      };
    }) => {
      const entry = this.entitlements.get(where.id);
      if (!entry) return { count: 0 };
      if (
        Object.hasOwn(where, "revokedAt") &&
        where.revokedAt === null &&
        entry.revokedAt !== null
      ) {
        return { count: 0 };
      }
      if (
        where.usedQuantity?.lt !== undefined &&
        !(entry.usedQuantity < where.usedQuantity.lt)
      ) {
        return { count: 0 };
      }
      if (
        where.usedQuantity?.gt !== undefined &&
        !(entry.usedQuantity > where.usedQuantity.gt)
      ) {
        return { count: 0 };
      }
      if (data.usedQuantity?.increment !== undefined) {
        entry.usedQuantity += data.usedQuantity.increment;
      }
      if (data.usedQuantity?.decrement !== undefined) {
        entry.usedQuantity = Math.max(
          0,
          entry.usedQuantity - data.usedQuantity.decrement,
        );
      }
      return { count: 1 };
    },
  };

  tenant = {
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { slug: string };
      create: { slug: string; name: string };
      update: { name: string };
    }) => {
      const existing = [...this.tenants.values()].find(
        (tenant) => tenant.slug === where.slug,
      );
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const id = this.nextId("tenant");
      const created = { id, ...create };
      this.tenants.set(id, created);
      return created;
    },
  };

  async $transaction<T>(fn: (tx: this) => Promise<T>): Promise<T> {
    return fn(this);
  }
}

const lapsedAt = new Date("2020-01-01T00:00:00.000Z");
const createdAt = new Date("2024-01-01T00:00:00.000Z");

const makeRepo = () => {
  const client = new FakePrismaClient();
  const repo = new PrismaPlatformRepository(
    client as unknown as PrismaClient,
    "test-key",
  );
  return { client, repo };
};

describe("PrismaPlatformRepository.registerManagedBot (reactivation)", () => {
  it("reactivates for free when the bot's own entitlement is still active", async () => {
    const { client, repo } = makeRepo();
    client.seedEntitlement({
      id: "ent_own",
      ownerTelegramId: 42n,
      kind: EntitlementKind.managed_bot_slot,
      template: "creator",
      quantity: 1,
      usedQuantity: 1,
      source: "promo",
      expiresAt: null,
      revokedAt: null,
      createdAt,
    });
    client.seedManagedBot({
      id: "bot_1",
      tenantId: "tenant_1",
      telegramBotId: 777n,
      username: "child_bot",
      displayName: "Child Bot",
      ownerTelegramId: 42n,
      template: "creator",
      status: ManagedBotStatus.suspended,
      entitlementId: "ent_own",
      plan: "custom",
      lastError: "webhook setup failed",
    });

    const result = await repo.registerManagedBot({
      ownerTelegramId: 42n,
      botTelegramId: 777n,
      username: "child_bot",
      displayName: "Child Bot",
    });

    expect(result).toMatchObject({ ok: true, isNew: false });
    expect(client.managedBots.get("bot_1")?.entitlementId).toBe("ent_own");
    expect(client.managedBots.get("bot_1")?.status).toBe(
      ManagedBotStatus.pending,
    );
    expect(client.entitlements.get("ent_own")?.usedQuantity).toBe(1);
  });

  it("consumes a fresh slot when the same owner's original entitlement lapsed", async () => {
    const { client, repo } = makeRepo();
    client.seedEntitlement({
      id: "ent_lapsed",
      ownerTelegramId: 42n,
      kind: EntitlementKind.managed_bot_slot,
      template: "creator",
      quantity: 1,
      usedQuantity: 1,
      source: "promo",
      expiresAt: null,
      revokedAt: lapsedAt,
      createdAt,
    });
    client.seedEntitlement({
      id: "ent_fresh",
      ownerTelegramId: 42n,
      kind: EntitlementKind.managed_bot_slot,
      template: "creator",
      quantity: 1,
      usedQuantity: 0,
      source: "promo",
      expiresAt: null,
      revokedAt: null,
      createdAt,
    });
    client.seedManagedBot({
      id: "bot_1",
      tenantId: "tenant_1",
      telegramBotId: 777n,
      username: "child_bot",
      displayName: "Child Bot",
      ownerTelegramId: 42n,
      template: "creator",
      status: ManagedBotStatus.suspended,
      entitlementId: "ent_lapsed",
      plan: "custom",
      lastError: null,
    });

    const result = await repo.registerManagedBot({
      ownerTelegramId: 42n,
      botTelegramId: 777n,
      username: "child_bot",
      displayName: "Child Bot",
    });

    expect(result).toMatchObject({ ok: true, isNew: false });
    expect(client.managedBots.get("bot_1")?.entitlementId).toBe("ent_fresh");
    expect(client.entitlements.get("ent_fresh")?.usedQuantity).toBe(1);
    expect(client.entitlements.get("ent_lapsed")?.usedQuantity).toBe(0);
  });

  it("fails closed with no-slot when the lapsed owner has no other free entitlement", async () => {
    const { client, repo } = makeRepo();
    client.seedEntitlement({
      id: "ent_lapsed",
      ownerTelegramId: 42n,
      kind: EntitlementKind.managed_bot_slot,
      template: "creator",
      quantity: 1,
      usedQuantity: 1,
      source: "promo",
      expiresAt: null,
      revokedAt: lapsedAt,
      createdAt,
    });
    client.seedManagedBot({
      id: "bot_1",
      tenantId: "tenant_1",
      telegramBotId: 777n,
      username: "child_bot",
      displayName: "Child Bot",
      ownerTelegramId: 42n,
      template: "creator",
      status: ManagedBotStatus.suspended,
      entitlementId: "ent_lapsed",
      plan: "custom",
      lastError: null,
    });

    const result = await repo.registerManagedBot({
      ownerTelegramId: 42n,
      botTelegramId: 777n,
      username: "child_bot",
      displayName: "Child Bot",
    });

    expect(result).toEqual({ ok: false, reason: "no-slot" });
    expect(client.managedBots.get("bot_1")).toMatchObject({
      status: ManagedBotStatus.suspended,
      entitlementId: "ent_lapsed",
      ownerTelegramId: 42n,
    });
  });

  it("refuses to hand an inactive bot over to a different claimed owner", async () => {
    const { client, repo } = makeRepo();
    client.seedEntitlement({
      id: "ent_original",
      ownerTelegramId: 42n,
      kind: EntitlementKind.managed_bot_slot,
      template: "creator",
      quantity: 1,
      usedQuantity: 1,
      source: "promo",
      expiresAt: null,
      revokedAt: null,
      createdAt,
    });
    client.seedEntitlement({
      id: "ent_other_owner",
      ownerTelegramId: 99n,
      kind: EntitlementKind.managed_bot_slot,
      template: "creator",
      quantity: 1,
      usedQuantity: 0,
      source: "promo",
      expiresAt: null,
      revokedAt: null,
      createdAt,
    });
    client.seedManagedBot({
      id: "bot_1",
      tenantId: "tenant_1",
      telegramBotId: 777n,
      username: "child_bot",
      displayName: "Child Bot",
      ownerTelegramId: 42n,
      template: "creator",
      status: ManagedBotStatus.suspended,
      entitlementId: "ent_original",
      plan: "custom",
      lastError: null,
    });

    const result = await repo.registerManagedBot({
      ownerTelegramId: 99n,
      botTelegramId: 777n,
      username: "child_bot",
      displayName: "Child Bot",
    });

    expect(result).toEqual({ ok: false, reason: "no-slot" });
    expect(client.managedBots.get("bot_1")).toMatchObject({
      status: ManagedBotStatus.suspended,
      entitlementId: "ent_original",
      ownerTelegramId: 42n,
    });
    expect(client.entitlements.get("ent_other_owner")?.usedQuantity).toBe(0);
  });

  it("still consumes exactly one slot for a brand-new bot", async () => {
    const { client, repo } = makeRepo();
    client.seedEntitlement({
      id: "ent_fresh",
      ownerTelegramId: 42n,
      kind: EntitlementKind.managed_bot_slot,
      template: "creator",
      quantity: 1,
      usedQuantity: 0,
      source: "promo",
      expiresAt: null,
      revokedAt: null,
      createdAt,
    });

    const result = await repo.registerManagedBot({
      ownerTelegramId: 42n,
      botTelegramId: 777n,
      username: "new_bot",
      displayName: "New Bot",
    });

    expect(result).toMatchObject({ ok: true, isNew: true });
    expect(client.entitlements.get("ent_fresh")?.usedQuantity).toBe(1);
  });

  it("returns the idempotent early exit for an already-active bot without mutating it", async () => {
    const { client, repo } = makeRepo();
    client.seedEntitlement({
      id: "ent_own",
      ownerTelegramId: 42n,
      kind: EntitlementKind.managed_bot_slot,
      template: "creator",
      quantity: 1,
      usedQuantity: 1,
      source: "promo",
      expiresAt: null,
      revokedAt: null,
      createdAt,
    });
    client.seedManagedBot({
      id: "bot_1",
      tenantId: "tenant_1",
      telegramBotId: 777n,
      username: "child_bot",
      displayName: "Child Bot",
      ownerTelegramId: 42n,
      template: "creator",
      status: ManagedBotStatus.active,
      entitlementId: "ent_own",
      plan: "custom",
      lastError: null,
    });

    const result = await repo.registerManagedBot({
      ownerTelegramId: 42n,
      botTelegramId: 777n,
      username: "child_bot",
      displayName: "Child Bot",
    });

    expect(result).toMatchObject({ ok: true, isNew: false });
    expect(client.managedBots.get("bot_1")?.status).toBe(
      ManagedBotStatus.active,
    );
    expect(client.entitlements.get("ent_own")?.usedQuantity).toBe(1);
  });
});
