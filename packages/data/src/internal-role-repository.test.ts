import { describe, expect, it } from "vitest";
import {
  InMemoryInternalRoleRepository,
  isInternalRole,
} from "./internal-role-repository.js";

describe("InMemoryInternalRoleRepository", () => {
  it("returns null for a user with no role set", async () => {
    const repo = new InMemoryInternalRoleRepository();
    expect(await repo.getRole("fed_1", 1n)).toBeNull();
  });

  it("sets and reads back a role", async () => {
    const repo = new InMemoryInternalRoleRepository();
    await repo.setRole("t1", "fed_1", 1n, "moderator");
    expect(await repo.getRole("fed_1", 1n)).toBe("moderator");
  });

  it("overwrites an existing role on re-set", async () => {
    const repo = new InMemoryInternalRoleRepository();
    await repo.setRole("t1", "fed_1", 1n, "support");
    await repo.setRole("t1", "fed_1", 1n, "analyst");
    expect(await repo.getRole("fed_1", 1n)).toBe("analyst");
  });

  it("lists all roles for a federation", async () => {
    const repo = new InMemoryInternalRoleRepository();
    await repo.setRole("t1", "fed_1", 2n, "moderator");
    await repo.setRole("t1", "fed_1", 1n, "owner");
    await repo.setRole("t1", "fed_2", 9n, "analyst");

    const roles = await repo.listRoles("fed_1");
    expect(roles).toHaveLength(2);
    expect(roles.map((r) => r.telegramUserId)).toEqual([1n, 2n]);
  });

  it("removes a role", async () => {
    const repo = new InMemoryInternalRoleRepository();
    await repo.setRole("t1", "fed_1", 1n, "read_only");
    await repo.removeRole("fed_1", 1n);
    expect(await repo.getRole("fed_1", 1n)).toBeNull();
  });

  it("removing a role that doesn't exist is a no-op", async () => {
    const repo = new InMemoryInternalRoleRepository();
    await expect(repo.removeRole("fed_1", 1n)).resolves.toBeUndefined();
  });

  it("scopes roles per federation", async () => {
    const repo = new InMemoryInternalRoleRepository();
    await repo.setRole("t1", "fed_1", 1n, "owner");
    await repo.setRole("t1", "fed_2", 1n, "read_only");
    expect(await repo.getRole("fed_1", 1n)).toBe("owner");
    expect(await repo.getRole("fed_2", 1n)).toBe("read_only");
  });

  it("validates the internal role set", () => {
    expect(isInternalRole("owner")).toBe(true);
    expect(isInternalRole("network_manager")).toBe(true);
    expect(isInternalRole("dictator")).toBe(false);
  });
});
