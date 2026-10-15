import { describe, expect, it } from "vitest";
import { InMemoryAdminDecisionRepository } from "./admin-decision-repository.js";

describe("InMemoryAdminDecisionRepository", () => {
  it("records and lists decisions for a chat, newest first", async () => {
    const repo = new InMemoryAdminDecisionRepository();
    await repo.record({
      tenantId: "t1",
      chatId: "c1",
      adminId: 100n,
      action: "warn",
      ruleId: "spam",
    });
    await repo.record({
      tenantId: "t1",
      chatId: "c1",
      adminId: 100n,
      action: "ban",
      ruleId: "spam",
    });

    const entries = await repo.listRecent("t1", "c1");
    expect(entries).toHaveLength(2);
    expect(entries[0]?.action).toBe("ban");
    expect(entries[1]?.action).toBe("warn");
    expect(entries.every((e) => e.adminId === 100n)).toBe(true);
    expect(entries.every((e) => e.ruleId === "spam")).toBe(true);
  });

  it("keeps decisions scoped per (tenant, chat)", async () => {
    const repo = new InMemoryAdminDecisionRepository();
    await repo.record({
      tenantId: "t1",
      chatId: "c1",
      adminId: 1n,
      action: "mute",
    });
    await repo.record({
      tenantId: "t1",
      chatId: "c2",
      adminId: 2n,
      action: "kick",
    });
    await repo.record({
      tenantId: "t2",
      chatId: "c1",
      adminId: 3n,
      action: "ban",
    });

    expect(await repo.listRecent("t1", "c1")).toHaveLength(1);
    expect(await repo.listRecent("t1", "c2")).toHaveLength(1);
    expect(await repo.listRecent("t2", "c1")).toHaveLength(1);
    expect((await repo.listRecent("t1", "c1"))[0]?.adminId).toBe(1n);
  });

  it("leaves ruleId undefined when not provided", async () => {
    const repo = new InMemoryAdminDecisionRepository();
    await repo.record({
      tenantId: "t1",
      chatId: "c1",
      adminId: 1n,
      action: "delete",
    });
    const [entry] = await repo.listRecent("t1", "c1");
    expect(entry?.ruleId).toBeUndefined();
  });

  it("respects the limit parameter", async () => {
    const repo = new InMemoryAdminDecisionRepository();
    for (let i = 0; i < 5; i += 1) {
      await repo.record({
        tenantId: "t1",
        chatId: "c1",
        adminId: 1n,
        action: `action-${i}`,
      });
    }
    const entries = await repo.listRecent("t1", "c1", 2);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.action).toBe("action-4");
    expect(entries[1]?.action).toBe("action-3");
  });
});
