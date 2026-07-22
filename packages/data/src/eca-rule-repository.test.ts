import { describe, expect, it } from "vitest";
import { InMemoryEcaRuleRepository } from "./eca-rule-repository.js";

describe("InMemoryEcaRuleRepository", () => {
  it("creates and lists rules for a tenant", async () => {
    const repo = new InMemoryEcaRuleRepository();
    await repo.create(
      "t1",
      null,
      "message",
      [{ field: "text", op: "contains", value: "spam" }],
      { kind: "delete" },
    );
    const list = await repo.list("t1");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      event: "message",
      enabled: true,
      lastFiredMs: null,
    });
  });

  it("lists both chat-specific and tenant-wide rules for a chat", async () => {
    const repo = new InMemoryEcaRuleRepository();
    await repo.create("t1", null, "new_member", [], {
      kind: "log",
      text: "join",
    });
    await repo.create("t1", "c1", "report", [], {
      kind: "notify_staff",
      text: "reporte",
    });
    await repo.create("t1", "c2", "report", [], {
      kind: "notify_staff",
      text: "reporte",
    });

    const forC1 = await repo.list("t1", "c1");
    expect(forC1.map((r) => r.event).sort()).toEqual(["new_member", "report"]);
  });

  it("updates a patch of fields and bumps updatedAt", async () => {
    const repo = new InMemoryEcaRuleRepository();
    const created = await repo.create("t1", null, "message", [], {
      kind: "log",
      text: "x",
    });
    const updated = await repo.update(created.id, { event: "new_member" });
    expect(updated?.event).toBe("new_member");
  });

  it("returns null when updating a non-existent rule", async () => {
    const repo = new InMemoryEcaRuleRepository();
    expect(await repo.update("does-not-exist", { event: "x" })).toBeNull();
  });

  it("removes a rule", async () => {
    const repo = new InMemoryEcaRuleRepository();
    const created = await repo.create("t1", null, "message", [], {
      kind: "log",
      text: "x",
    });
    expect(await repo.remove(created.id)).toBe(true);
    expect(await repo.list("t1")).toHaveLength(0);
  });

  it("returns false when removing a non-existent rule", async () => {
    const repo = new InMemoryEcaRuleRepository();
    expect(await repo.remove("nope")).toBe(false);
  });

  it("toggles enabled state", async () => {
    const repo = new InMemoryEcaRuleRepository();
    const created = await repo.create("t1", null, "message", [], {
      kind: "log",
      text: "x",
    });
    expect(await repo.setEnabled(created.id, false)).toBe(true);
    const list = await repo.list("t1");
    expect(list[0]?.enabled).toBe(false);
  });

  it("returns false when toggling a non-existent rule", async () => {
    const repo = new InMemoryEcaRuleRepository();
    expect(await repo.setEnabled("nope", false)).toBe(false);
  });

  describe("listActiveForEvent", () => {
    it("only returns enabled rules matching the event, scoped to the chat or tenant-wide", async () => {
      const repo = new InMemoryEcaRuleRepository();
      const tenantWide = await repo.create("t1", null, "message", [], {
        kind: "delete",
      });
      const chatOnly = await repo.create("t1", "c1", "message", [], {
        kind: "delete",
      });
      const otherChat = await repo.create("t1", "c2", "message", [], {
        kind: "delete",
      });
      const otherEvent = await repo.create("t1", null, "new_member", [], {
        kind: "delete",
      });
      const disabled = await repo.create("t1", null, "message", [], {
        kind: "delete",
      });
      await repo.setEnabled(disabled.id, false);

      const active = await repo.listActiveForEvent("t1", "c1", "message");
      const ids = active.map((r) => r.id).sort();
      expect(ids).toEqual([chatOnly.id, tenantWide.id].sort());
      expect(ids).not.toContain(otherChat.id);
      expect(ids).not.toContain(otherEvent.id);
      expect(ids).not.toContain(disabled.id);
    });
  });

  describe("recordFired", () => {
    it("persists lastFiredMs so cooldown survives a process restart", async () => {
      const repo = new InMemoryEcaRuleRepository();
      const created = await repo.create("t1", null, "message", [], {
        kind: "delete",
      });
      expect(created.lastFiredMs).toBeNull();
      expect(await repo.recordFired(created.id, 1_000)).toBe(true);
      const list = await repo.list("t1");
      expect(list[0]?.lastFiredMs).toBe(1_000);
    });

    it("returns false when recording a fire for a non-existent rule", async () => {
      const repo = new InMemoryEcaRuleRepository();
      expect(await repo.recordFired("nope", 1_000)).toBe(false);
    });
  });
});
