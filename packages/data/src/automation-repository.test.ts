import { describe, expect, it } from "vitest";
import {
  InMemoryAutomationRepository,
  matchAutomation,
} from "./automation-repository.js";

describe("matchAutomation", () => {
  it("matches contains_text case-insensitively as a substring", () => {
    const automation = {
      trigger: { kind: "contains_text" as const, text: "SPAM" },
      condition: { kind: "none" as const },
    };
    expect(
      matchAutomation(automation, {
        kind: "message",
        text: "esto es spam puro",
      }),
    ).toBe(true);
    expect(
      matchAutomation(automation, { kind: "message", text: "todo normal" }),
    ).toBe(false);
  });

  it("matches contains_link for http(s) URLs and t.me links", () => {
    const automation = {
      trigger: { kind: "contains_link" as const },
      condition: { kind: "none" as const },
    };
    expect(
      matchAutomation(automation, {
        kind: "message",
        text: "mira esto https://evil.example",
      }),
    ).toBe(true);
    expect(
      matchAutomation(automation, {
        kind: "message",
        text: "unete a t.me/spam",
      }),
    ).toBe(true);
    expect(
      matchAutomation(automation, {
        kind: "message",
        text: "sin enlaces aqui",
      }),
    ).toBe(false);
  });

  it("matches new_member trigger only for new_member events", () => {
    const automation = {
      trigger: { kind: "new_member" as const },
      condition: { kind: "none" as const },
    };
    expect(matchAutomation(automation, { kind: "new_member" })).toBe(true);
    expect(matchAutomation(automation, { kind: "message", text: "hola" })).toBe(
      false,
    );
  });

  it("matches report trigger only for report events", () => {
    const automation = {
      trigger: { kind: "report" as const },
      condition: { kind: "none" as const },
    };
    expect(matchAutomation(automation, { kind: "report" })).toBe(true);
    expect(matchAutomation(automation, { kind: "new_member" })).toBe(false);
  });

  it("combines contains_text trigger with is_new_user condition", () => {
    const automation = {
      trigger: { kind: "contains_text" as const, text: "gratis" },
      condition: { kind: "is_new_user" as const, maxAgeHours: 24 },
    };
    expect(
      matchAutomation(automation, {
        kind: "message",
        text: "dinero gratis",
        isNewUser: true,
      }),
    ).toBe(true);
    expect(
      matchAutomation(automation, {
        kind: "message",
        text: "dinero gratis",
        isNewUser: false,
      }),
    ).toBe(false);
  });

  it("combines new_member trigger with source_chat condition", () => {
    const automation = {
      trigger: { kind: "new_member" as const },
      condition: { kind: "source_chat" as const, chatId: "c1" },
    };
    expect(
      matchAutomation(automation, { kind: "new_member", chatId: "c1" }),
    ).toBe(true);
    expect(
      matchAutomation(automation, { kind: "new_member", chatId: "c2" }),
    ).toBe(false);
  });

  it("returns false for schedule and high_risk triggers (runtime-only context)", () => {
    expect(
      matchAutomation(
        {
          trigger: { kind: "schedule", cron: "0 * * * *" },
          condition: { kind: "none" },
        },
        { kind: "message", text: "cualquier cosa" },
      ),
    ).toBe(false);
    expect(
      matchAutomation(
        { trigger: { kind: "high_risk" }, condition: { kind: "none" } },
        { kind: "message", text: "cualquier cosa" },
      ),
    ).toBe(false);
  });

  it("returns false for not_in_chat and missing_badge conditions (runtime-only context)", () => {
    expect(
      matchAutomation(
        {
          trigger: { kind: "new_member" },
          condition: { kind: "not_in_chat", telegramChatId: "-100" },
        },
        { kind: "new_member" },
      ),
    ).toBe(false);
    expect(
      matchAutomation(
        {
          trigger: { kind: "new_member" },
          condition: { kind: "missing_badge", badge: "veteran" },
        },
        { kind: "new_member" },
      ),
    ).toBe(false);
  });

  it("requires both trigger and condition to match", () => {
    const automation = {
      trigger: { kind: "contains_link" as const },
      condition: { kind: "source_chat" as const, chatId: "c1" },
    };
    expect(
      matchAutomation(automation, {
        kind: "message",
        text: "https://x.test",
        chatId: "c2",
      }),
    ).toBe(false);
  });
});

describe("InMemoryAutomationRepository", () => {
  it("creates and lists automations for a network", async () => {
    const repo = new InMemoryAutomationRepository();
    await repo.create(
      "t1",
      "fed1",
      null,
      "Borra spam",
      { kind: "contains_link" },
      { kind: "none" },
      { kind: "delete" },
    );
    const list = await repo.list("fed1");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: "Borra spam", enabled: true });
  });

  it("lists both chat-specific and network-wide automations for a chat", async () => {
    const repo = new InMemoryAutomationRepository();
    await repo.create(
      "t1",
      "fed1",
      null,
      "Global",
      { kind: "new_member" },
      { kind: "none" },
      { kind: "log", text: "join" },
    );
    await repo.create(
      "t1",
      "fed1",
      "c1",
      "Solo c1",
      { kind: "report" },
      { kind: "none" },
      { kind: "notify_staff", text: "reporte" },
    );
    await repo.create(
      "t1",
      "fed1",
      "c2",
      "Solo c2",
      { kind: "report" },
      { kind: "none" },
      { kind: "notify_staff", text: "reporte" },
    );

    const forC1 = await repo.list("fed1", "c1");
    expect(forC1.map((a) => a.name).sort()).toEqual(["Global", "Solo c1"]);
  });

  it("updates a patch of fields and bumps updatedAt", async () => {
    const repo = new InMemoryAutomationRepository();
    const created = await repo.create(
      "t1",
      "fed1",
      null,
      "Nombre",
      { kind: "new_member" },
      { kind: "none" },
      { kind: "log", text: "x" },
    );
    const updated = await repo.update(created.id, { name: "Nuevo nombre" });
    expect(updated?.name).toBe("Nuevo nombre");
    expect(updated?.trigger).toEqual({ kind: "new_member" });
  });

  it("returns null when updating a non-existent automation", async () => {
    const repo = new InMemoryAutomationRepository();
    const result = await repo.update("does-not-exist", { name: "x" });
    expect(result).toBeNull();
  });

  it("removes an automation", async () => {
    const repo = new InMemoryAutomationRepository();
    const created = await repo.create(
      "t1",
      "fed1",
      null,
      "Nombre",
      { kind: "new_member" },
      { kind: "none" },
      { kind: "log", text: "x" },
    );
    expect(await repo.remove(created.id)).toBe(true);
    expect(await repo.list("fed1")).toHaveLength(0);
  });

  it("returns false when removing a non-existent automation", async () => {
    const repo = new InMemoryAutomationRepository();
    expect(await repo.remove("nope")).toBe(false);
  });

  it("toggles enabled state", async () => {
    const repo = new InMemoryAutomationRepository();
    const created = await repo.create(
      "t1",
      "fed1",
      null,
      "Nombre",
      { kind: "new_member" },
      { kind: "none" },
      { kind: "log", text: "x" },
    );
    expect(await repo.setEnabled(created.id, false)).toBe(true);
    const list = await repo.list("fed1");
    expect(list[0]?.enabled).toBe(false);
  });

  it("returns false when toggling a non-existent automation", async () => {
    const repo = new InMemoryAutomationRepository();
    expect(await repo.setEnabled("nope", false)).toBe(false);
  });
});
