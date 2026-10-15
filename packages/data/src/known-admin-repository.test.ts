import { describe, expect, it } from "vitest";
import { InMemoryKnownAdminRepository } from "./known-admin-repository.js";

describe("InMemoryKnownAdminRepository", () => {
  it("tracks a known admin per (tenant, chat)", async () => {
    const repo = new InMemoryKnownAdminRepository();
    await repo.addKnownAdmin("t1", "c1", 111n);
    expect(await repo.listKnownAdmins("t1", "c1")).toEqual([111n]);
    expect(await repo.listKnownAdmins("t1", "c2")).toEqual([]);
  });

  it("is idempotent when the same admin is added twice", async () => {
    const repo = new InMemoryKnownAdminRepository();
    await repo.addKnownAdmin("t1", "c1", 111n);
    await repo.addKnownAdmin("t1", "c1", 111n);
    expect(await repo.listKnownAdmins("t1", "c1")).toEqual([111n]);
  });

  it("keeps admins for different chats of the same tenant distinct", async () => {
    const repo = new InMemoryKnownAdminRepository();
    await repo.addKnownAdmin("t1", "c1", 111n);
    await repo.addKnownAdmin("t1", "c2", 222n);
    expect(await repo.listKnownAdmins("t1", "c1")).toEqual([111n]);
    expect(await repo.listKnownAdmins("t1", "c2")).toEqual([222n]);
  });

  it("keeps admins for different tenants of the same chat id distinct", async () => {
    const repo = new InMemoryKnownAdminRepository();
    await repo.addKnownAdmin("t1", "c1", 111n);
    await repo.addKnownAdmin("t2", "c1", 222n);
    expect(await repo.listKnownAdmins("t1", "c1")).toEqual([111n]);
    expect(await repo.listKnownAdmins("t2", "c1")).toEqual([222n]);
  });

  it("removes a known admin", async () => {
    const repo = new InMemoryKnownAdminRepository();
    await repo.addKnownAdmin("t1", "c1", 111n);
    await repo.addKnownAdmin("t1", "c1", 222n);
    await repo.removeKnownAdmin("t1", "c1", 111n);
    expect(await repo.listKnownAdmins("t1", "c1")).toEqual([222n]);
  });

  it("removing an untracked admin is a no-op", async () => {
    const repo = new InMemoryKnownAdminRepository();
    await repo.removeKnownAdmin("t1", "c1", 999n);
    expect(await repo.listKnownAdmins("t1", "c1")).toEqual([]);
  });

  it("returns an empty list for a chat that has never had a known admin", async () => {
    const repo = new InMemoryKnownAdminRepository();
    expect(await repo.listKnownAdmins("t1", "unknown-chat")).toEqual([]);
  });
});
