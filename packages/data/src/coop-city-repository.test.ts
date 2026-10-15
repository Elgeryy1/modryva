import { describe, expect, it } from "vitest";
import { InMemoryCoopCityContributionRepository } from "./coop-city-repository.js";

describe("InMemoryCoopCityContributionRepository", () => {
  it("accumulates a member's contribution across calls", async () => {
    const repo = new InMemoryCoopCityContributionRepository();
    await repo.addContribution("t1", "c1", 111n, 10);
    await repo.addContribution("t1", "c1", 111n, 5);
    const rows = await repo.listContributions("t1", "c1");
    expect(rows).toEqual([{ telegramUserId: 111n, resources: 15 }]);
  });

  it("keeps contributions separate per member, chat and tenant", async () => {
    const repo = new InMemoryCoopCityContributionRepository();
    await repo.addContribution("t1", "c1", 111n, 10);
    await repo.addContribution("t1", "c1", 222n, 20);
    await repo.addContribution("t1", "c2", 111n, 30);
    await repo.addContribution("t2", "c1", 111n, 40);

    const c1 = await repo.listContributions("t1", "c1");
    expect(
      c1.sort((a, b) => Number(a.telegramUserId - b.telegramUserId)),
    ).toEqual([
      { telegramUserId: 111n, resources: 10 },
      { telegramUserId: 222n, resources: 20 },
    ]);
    expect(await repo.listContributions("t1", "c2")).toEqual([
      { telegramUserId: 111n, resources: 30 },
    ]);
    expect(await repo.listContributions("t2", "c1")).toEqual([
      { telegramUserId: 111n, resources: 40 },
    ]);
  });

  it("returns an empty list for a chat with no contributions", async () => {
    const repo = new InMemoryCoopCityContributionRepository();
    expect(await repo.listContributions("t1", "c1")).toEqual([]);
  });

  it("resetContributions clears only the targeted chat", async () => {
    const repo = new InMemoryCoopCityContributionRepository();
    await repo.addContribution("t1", "c1", 111n, 10);
    await repo.addContribution("t1", "c2", 111n, 20);

    await repo.resetContributions("t1", "c1");

    expect(await repo.listContributions("t1", "c1")).toEqual([]);
    expect(await repo.listContributions("t1", "c2")).toEqual([
      { telegramUserId: 111n, resources: 20 },
    ]);
  });
});
