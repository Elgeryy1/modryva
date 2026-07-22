import { describe, expect, it } from "vitest";
import { InMemoryDebateDuelVoteRepository } from "./debate-duel-repository.js";

describe("InMemoryDebateDuelVoteRepository", () => {
  it("counts distinct voters for a message", async () => {
    const repo = new InMemoryDebateDuelVoteRepository();
    await repo.recordVote("t1", "c1", 100n, 1n);
    await repo.recordVote("t1", "c1", 100n, 2n);
    await repo.recordVote("t1", "c1", 100n, 3n);
    expect(await repo.getVoteCount("t1", "c1", 100n)).toBe(3);
  });

  it("is idempotent per (tenant, chat, message, voter)", async () => {
    const repo = new InMemoryDebateDuelVoteRepository();
    await repo.recordVote("t1", "c1", 100n, 1n);
    await repo.recordVote("t1", "c1", 100n, 1n);
    await repo.recordVote("t1", "c1", 100n, 1n);
    expect(await repo.getVoteCount("t1", "c1", 100n)).toBe(1);
  });

  it("keeps votes for different messages separate", async () => {
    const repo = new InMemoryDebateDuelVoteRepository();
    await repo.recordVote("t1", "c1", 100n, 1n);
    await repo.recordVote("t1", "c1", 100n, 2n);
    await repo.recordVote("t1", "c1", 200n, 1n);
    expect(await repo.getVoteCount("t1", "c1", 100n)).toBe(2);
    expect(await repo.getVoteCount("t1", "c1", 200n)).toBe(1);
  });

  it("keeps votes scoped per tenant and chat", async () => {
    const repo = new InMemoryDebateDuelVoteRepository();
    await repo.recordVote("t1", "c1", 100n, 1n);
    await repo.recordVote("t2", "c1", 100n, 1n);
    await repo.recordVote("t1", "c2", 100n, 1n);
    expect(await repo.getVoteCount("t1", "c1", 100n)).toBe(1);
    expect(await repo.getVoteCount("t2", "c1", 100n)).toBe(1);
    expect(await repo.getVoteCount("t1", "c2", 100n)).toBe(1);
  });

  it("reports zero votes for an unknown message", async () => {
    const repo = new InMemoryDebateDuelVoteRepository();
    expect(await repo.getVoteCount("t1", "c1", 999n)).toBe(0);
  });

  it("lets the same voter cast a vote on two different messages", async () => {
    const repo = new InMemoryDebateDuelVoteRepository();
    await repo.recordVote("t1", "c1", 100n, 1n);
    await repo.recordVote("t1", "c1", 200n, 1n);
    expect(await repo.getVoteCount("t1", "c1", 100n)).toBe(1);
    expect(await repo.getVoteCount("t1", "c1", 200n)).toBe(1);
  });
});
