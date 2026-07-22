import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { PrismaAiRepository } from "./ai-repository.js";

const clientWith = (aiMemory: Record<string, unknown>): PrismaClient =>
  ({ aiMemory }) as unknown as PrismaClient;

describe("PrismaAiRepository — memory management", () => {
  it("listUserMemories queries the user subject, tenant-scoped, oldest first", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "m1", key: "preferred_name", value: "Alex", source: "user" },
      {
        id: "m2",
        key: "note:abc",
        value: "prefiero respuestas cortas",
        source: "explicit",
      },
    ]);
    const repo = new PrismaAiRepository(clientWith({ findMany }));

    const out = await repo.listUserMemories({
      tenantId: "t1",
      telegramUserId: 42n,
    });

    expect(findMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", subjectId: "user:42" },
      orderBy: { createdAt: "asc" },
    });
    expect(out).toEqual([
      { id: "m1", key: "preferred_name", value: "Alex", source: "user" },
      {
        id: "m2",
        key: "note:abc",
        value: "prefiero respuestas cortas",
        source: "explicit",
      },
    ]);
  });

  it("deleteMemory scopes the delete by tenant AND id (no cross-tenant delete)", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const repo = new PrismaAiRepository(clientWith({ deleteMany }));

    const ok = await repo.deleteMemory({ tenantId: "t1", id: "m1" });

    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: "m1", tenantId: "t1" },
    });
    expect(ok).toBe(true);
  });

  it("deleteMemory returns false when nothing matched (wrong tenant or id)", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const repo = new PrismaAiRepository(clientWith({ deleteMany }));
    expect(await repo.deleteMemory({ tenantId: "t1", id: "nope" })).toBe(false);
  });

  it("clearUserMemories wipes only that user's subject and returns the count", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 3 });
    const repo = new PrismaAiRepository(clientWith({ deleteMany }));

    const n = await repo.clearUserMemories({
      tenantId: "t1",
      telegramUserId: 42n,
    });

    expect(deleteMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", subjectId: "user:42" },
    });
    expect(n).toBe(3);
  });
});
