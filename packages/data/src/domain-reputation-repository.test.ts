import { describe, expect, it } from "vitest";
import { InMemoryDomainReputationRepository } from "./domain-reputation-repository.js";

describe("InMemoryDomainReputationRepository", () => {
  it("reports a domain as unseen until it is recorded", async () => {
    const repo = new InMemoryDomainReputationRepository();
    expect(await repo.hasSeenDomain("t1", "example.com")).toBe(false);
    await repo.recordDomainSeen("t1", "example.com");
    expect(await repo.hasSeenDomain("t1", "example.com")).toBe(true);
  });

  it("normalizes domains before comparing (case, www., trailing dot)", async () => {
    const repo = new InMemoryDomainReputationRepository();
    await repo.recordDomainSeen("t1", "Example.com.");
    expect(await repo.hasSeenDomain("t1", "www.EXAMPLE.com")).toBe(true);
    expect(await repo.hasSeenDomain("t1", "example.com")).toBe(true);
  });

  it("keeps first-seen state separate per tenant", async () => {
    const repo = new InMemoryDomainReputationRepository();
    await repo.recordDomainSeen("t1", "example.com");
    expect(await repo.hasSeenDomain("t2", "example.com")).toBe(false);
  });

  it("is idempotent: recording twice does not change the seen result", async () => {
    const repo = new InMemoryDomainReputationRepository();
    await repo.recordDomainSeen("t1", "example.com");
    await repo.recordDomainSeen("t1", "example.com");
    expect(await repo.hasSeenDomain("t1", "example.com")).toBe(true);
  });

  it("treats an empty or unparseable domain as a no-op", async () => {
    const repo = new InMemoryDomainReputationRepository();
    await repo.recordDomainSeen("t1", "   ");
    expect(await repo.hasSeenDomain("t1", "   ")).toBe(false);
    expect(await repo.hasSeenDomain("t1", "")).toBe(false);
  });
});
