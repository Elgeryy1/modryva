import { describe, expect, it } from "vitest";
import { InMemoryMemorySequenceRepository } from "./memory-sequence-repository.js";

describe("InMemoryMemorySequenceRepository", () => {
  it("has no active session before one is started", async () => {
    const repo = new InMemoryMemorySequenceRepository();
    expect(await repo.getActive("c1", 1n)).toBeNull();
  });

  it("starts a session and returns it as active", async () => {
    const repo = new InMemoryMemorySequenceRepository();
    const session = await repo.start({
      tenantId: "t1",
      chatId: "c1",
      telegramUserId: 42n,
      seed: 123,
      length: 4,
    });

    expect(session.tenantId).toBe("t1");
    expect(session.chatId).toBe("c1");
    expect(session.telegramUserId).toBe(42n);
    expect(session.seed).toBe(123);
    expect(session.length).toBe(4);
    expect(session.startedAt).toBeInstanceOf(Date);

    const active = await repo.getActive("c1", 42n);
    expect(active).toEqual(session);
  });

  it("keeps sessions distinct per (chat, user)", async () => {
    const repo = new InMemoryMemorySequenceRepository();
    await repo.start({
      tenantId: "t1",
      chatId: "c1",
      telegramUserId: 1n,
      seed: 1,
      length: 4,
    });
    await repo.start({
      tenantId: "t1",
      chatId: "c1",
      telegramUserId: 2n,
      seed: 2,
      length: 5,
    });
    await repo.start({
      tenantId: "t1",
      chatId: "c2",
      telegramUserId: 1n,
      seed: 3,
      length: 6,
    });

    expect((await repo.getActive("c1", 1n))?.seed).toBe(1);
    expect((await repo.getActive("c1", 2n))?.seed).toBe(2);
    expect((await repo.getActive("c2", 1n))?.seed).toBe(3);
  });

  it("replaces a prior session for the same (chat, user)", async () => {
    const repo = new InMemoryMemorySequenceRepository();
    await repo.start({
      tenantId: "t1",
      chatId: "c1",
      telegramUserId: 1n,
      seed: 111,
      length: 3,
    });
    const second = await repo.start({
      tenantId: "t1",
      chatId: "c1",
      telegramUserId: 1n,
      seed: 222,
      length: 8,
    });

    const active = await repo.getActive("c1", 1n);
    expect(active?.seed).toBe(222);
    expect(active?.length).toBe(8);
    expect(active).toEqual(second);
  });

  it("clears a session so it is no longer active", async () => {
    const repo = new InMemoryMemorySequenceRepository();
    await repo.start({
      tenantId: "t1",
      chatId: "c1",
      telegramUserId: 1n,
      seed: 1,
      length: 4,
    });
    await repo.clear("c1", 1n);
    expect(await repo.getActive("c1", 1n)).toBeNull();
  });

  it("clear is idempotent when there is nothing to clear", async () => {
    const repo = new InMemoryMemorySequenceRepository();
    await expect(repo.clear("nope", 999n)).resolves.toBeUndefined();
  });

  it("does not confuse different chats or users when clearing", async () => {
    const repo = new InMemoryMemorySequenceRepository();
    await repo.start({
      tenantId: "t1",
      chatId: "c1",
      telegramUserId: 1n,
      seed: 1,
      length: 4,
    });
    await repo.start({
      tenantId: "t1",
      chatId: "c1",
      telegramUserId: 2n,
      seed: 2,
      length: 4,
    });
    await repo.clear("c1", 1n);
    expect(await repo.getActive("c1", 1n)).toBeNull();
    expect(await repo.getActive("c1", 2n)).not.toBeNull();
  });
});
