import { describe, expect, it } from "vitest";
import { InMemoryGamificationRepository } from "./gamification-repository.js";

const TENANT = "t1";
const FED = "fed1";
const USER = 42n;

describe("InMemoryGamificationRepository", () => {
  it("ensureMissions creates the 3 fixed missions", async () => {
    const repo = new InMemoryGamificationRepository();
    const missions = await repo.ensureMissions(TENANT, FED, USER);
    expect(missions).toHaveLength(3);
    expect(missions.map((m) => m.kind).sort()).toEqual(
      ["first_message", "joined_required_group", "read_rules"].sort(),
    );
    expect(missions.every((m) => m.completedAt === null)).toBe(true);
  });

  it("ensureMissions is idempotent and does not duplicate on a second call", async () => {
    const repo = new InMemoryGamificationRepository();
    await repo.ensureMissions(TENANT, FED, USER);
    const second = await repo.ensureMissions(TENANT, FED, USER);
    expect(second).toHaveLength(3);
  });

  it("completeMission only counts once when called twice", async () => {
    const repo = new InMemoryGamificationRepository();
    await repo.ensureMissions(TENANT, FED, USER);

    const first = await repo.completeMission(
      TENANT,
      FED,
      USER,
      "first_message",
    );
    expect(first).toEqual({ completed: true, alreadyDone: false });

    const second = await repo.completeMission(
      TENANT,
      FED,
      USER,
      "first_message",
    );
    expect(second).toEqual({ completed: true, alreadyDone: true });

    const missions = await repo.listMissions(FED, USER);
    const mission = missions.find((m) => m.kind === "first_message");
    expect(mission?.completedAt).not.toBeNull();
  });

  it("completeMission works without a prior ensureMissions call", async () => {
    const repo = new InMemoryGamificationRepository();
    const result = await repo.completeMission(TENANT, FED, USER, "read_rules");
    expect(result).toEqual({ completed: true, alreadyDone: false });
  });

  it("awardBadge does not award the same badge twice", async () => {
    const repo = new InMemoryGamificationRepository();
    const first = await repo.awardBadge(TENANT, FED, USER, "network_verified");
    expect(first).toEqual({ awarded: true });

    const second = await repo.awardBadge(TENANT, FED, USER, "network_verified");
    expect(second).toEqual({ awarded: false });

    const badges = await repo.listBadges(FED, USER);
    expect(badges).toEqual(["network_verified"]);
  });

  it("listBadges returns distinct badges for a user", async () => {
    const repo = new InMemoryGamificationRepository();
    await repo.awardBadge(TENANT, FED, USER, "badge_a");
    await repo.awardBadge(TENANT, FED, USER, "badge_b");
    await repo.awardBadge(TENANT, FED, USER, "badge_a");

    const badges = await repo.listBadges(FED, USER);
    expect(badges).toEqual(["badge_a", "badge_b"]);
  });

  it("getNetworkRanking orders users by badge count descending", async () => {
    const repo = new InMemoryGamificationRepository();
    const userA = 1n;
    const userB = 2n;
    const userC = 3n;

    await repo.awardBadge(TENANT, FED, userA, "b1");
    await repo.awardBadge(TENANT, FED, userB, "b1");
    await repo.awardBadge(TENANT, FED, userB, "b2");
    await repo.awardBadge(TENANT, FED, userB, "b3");
    await repo.awardBadge(TENANT, FED, userC, "b1");
    await repo.awardBadge(TENANT, FED, userC, "b2");

    const ranking = await repo.getNetworkRanking(FED, 10);
    expect(ranking).toEqual([
      { telegramUserId: userB, badgeCount: 3 },
      { telegramUserId: userC, badgeCount: 2 },
      { telegramUserId: userA, badgeCount: 1 },
    ]);
  });

  it("getNetworkRanking respects the limit", async () => {
    const repo = new InMemoryGamificationRepository();
    await repo.awardBadge(TENANT, FED, 1n, "b1");
    await repo.awardBadge(TENANT, FED, 2n, "b1");
    await repo.awardBadge(TENANT, FED, 3n, "b1");

    const ranking = await repo.getNetworkRanking(FED, 2);
    expect(ranking).toHaveLength(2);
  });

  it("getNetworkRanking scopes badges by fedId", async () => {
    const repo = new InMemoryGamificationRepository();
    await repo.awardBadge(TENANT, FED, USER, "b1");
    await repo.awardBadge(TENANT, "other-fed", USER, "b1");

    const ranking = await repo.getNetworkRanking(FED, 10);
    expect(ranking).toEqual([{ telegramUserId: USER, badgeCount: 1 }]);
  });

  it("listMissions returns all 3 missions even without ensureMissions", async () => {
    const repo = new InMemoryGamificationRepository();
    const missions = await repo.listMissions(FED, USER);
    expect(missions).toHaveLength(3);
    expect(missions.every((m) => m.completedAt === null)).toBe(true);
  });
});
