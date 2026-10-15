import { describe, expect, it } from "vitest";
import { InMemoryMiniappVisitRepository } from "./miniapp-visit-repository.js";

const GROUP = -1009000000001n;

describe("MiniappVisitRepository", () => {
  it("counts a repeat open from the same connection instead of adding a row", async () => {
    const repo = new InMemoryMiniappVisitRepository();
    const visit = {
      botUsername: "modryvabot",
      telegramUserId: 1n,
      ip: "10.0.0.1",
      surface: "games",
      groupTelegramId: GROUP,
    };
    await repo.record(visit);
    await repo.record(visit);

    const rows = await repo.listForGroup("modryvabot", GROUP, []);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.visits).toBe(2);
  });

  it("keeps a NEW connection as its own row — that is the multi-account signal", async () => {
    const repo = new InMemoryMiniappVisitRepository();
    await repo.record({
      botUsername: "modryvabot",
      telegramUserId: 1n,
      ip: "10.0.0.1",
      surface: "games",
      groupTelegramId: GROUP,
    });
    await repo.record({
      botUsername: "modryvabot",
      telegramUserId: 1n,
      ip: "10.0.0.2",
      surface: "games",
      groupTelegramId: GROUP,
    });
    expect(await repo.listForGroup("modryvabot", GROUP, [])).toHaveLength(2);
  });

  it("refreshes the name on every visit — a stale @ is worse than none", async () => {
    const repo = new InMemoryMiniappVisitRepository();
    await repo.record({
      botUsername: "modryvabot",
      telegramUserId: 1n,
      ip: "10.0.0.1",
      surface: "games",
      groupTelegramId: GROUP,
      username: "viejo",
    });
    await repo.record({
      botUsername: "modryvabot",
      telegramUserId: 1n,
      ip: "10.0.0.1",
      surface: "games",
      groupTelegramId: GROUP,
      username: "nuevo",
    });
    const rows = await repo.listForGroup("modryvabot", GROUP, []);
    expect(rows[0]?.username).toBe("nuevo");
  });

  it("preserves firstSeenAt across visits", async () => {
    const repo = new InMemoryMiniappVisitRepository();
    const visit = {
      botUsername: "modryvabot",
      telegramUserId: 1n,
      ip: "10.0.0.1",
      surface: "games",
      groupTelegramId: GROUP,
    };
    await repo.record(visit);
    const first = (await repo.listForGroup("modryvabot", GROUP, []))[0]
      ?.firstSeenAt;
    await repo.record(visit);
    expect(
      (await repo.listForGroup("modryvabot", GROUP, []))[0]?.firstSeenAt,
    ).toEqual(first);
  });
});

describe("MiniappVisitRepository — group scoping", () => {
  const OTHER_GROUP = -1009000000007n;

  it("never shows one community's visitors to another's admins", async () => {
    // A single bot serves many groups. Without this filter, someone who only
    // ever played in an unrelated group would show up — IP and all — in this
    // group's roster, in front of admins who have nothing to do with them.
    const repo = new InMemoryMiniappVisitRepository();
    await repo.record({
      botUsername: "modryvabot",
      telegramUserId: 99n,
      ip: "10.0.0.9",
      surface: "games",
      groupTelegramId: OTHER_GROUP,
    });

    expect(await repo.listForGroup("modryvabot", GROUP, [])).toEqual([]);
    expect(await repo.listForGroup("modryvabot", OTHER_GROUP, [])).toHaveLength(
      1,
    );
  });

  it("shows a group-less open only for someone already known to this group", async () => {
    const repo = new InMemoryMiniappVisitRepository();
    await repo.record({
      botUsername: "modryvabot",
      telegramUserId: 7n,
      ip: "10.0.0.7",
      surface: "games",
    });

    expect(await repo.listForGroup("modryvabot", GROUP, [])).toEqual([]);
    expect(await repo.listForGroup("modryvabot", GROUP, [7n])).toHaveLength(1);
  });

  it("upgrades a group-less row once an open names a group, never the reverse", async () => {
    const repo = new InMemoryMiniappVisitRepository();
    const base = {
      botUsername: "modryvabot",
      telegramUserId: 7n,
      ip: "10.0.0.7",
      surface: "games",
    };
    await repo.record(base);
    await repo.record({ ...base, groupTelegramId: GROUP });
    expect(await repo.listForGroup("modryvabot", GROUP, [])).toHaveLength(1);

    // A later group-less open must not un-scope a row that is already placed.
    await repo.record(base);
    expect(await repo.listForGroup("modryvabot", GROUP, [])).toHaveLength(1);
  });
});

describe("MiniappVisitRepository — cross-group scoping", () => {
  const MINE_A = -1009000000001n;
  const MINE_B = -1009000000008n;
  const THEIRS = -1009000000007n;

  const open = (telegramUserId: bigint, groupTelegramId?: bigint) => ({
    botUsername: "modryvabot",
    telegramUserId,
    ip: `10.0.0.${telegramUserId}`,
    surface: "games",
    ...(groupTelegramId === undefined ? {} : { groupTelegramId }),
  });

  it("merges the groups it was given and no others", async () => {
    const repo = new InMemoryMiniappVisitRepository();
    await repo.record(open(1n, MINE_A));
    await repo.record(open(2n, MINE_B));
    await repo.record(open(3n, THEIRS));

    const rows = await repo.listForGroups("modryvabot", [MINE_A, MINE_B], []);
    expect(rows.map((r) => r.telegramUserId).sort()).toEqual([1n, 2n]);
  });

  it("widening the group list still cannot reach an unrelated community", async () => {
    // The failure this guards against: a cross-group view that quietly becomes
    // "everything this bot ever saw" the moment someone passes more groups.
    const repo = new InMemoryMiniappVisitRepository();
    await repo.record(open(3n, THEIRS));
    expect(
      await repo.listForGroups("modryvabot", [MINE_A, MINE_B], []),
    ).toEqual([]);
  });

  it("returns nothing for an empty group list rather than everything", async () => {
    // An admin of zero groups must get zero rows — not an unfiltered dump.
    const repo = new InMemoryMiniappVisitRepository();
    await repo.record(open(1n, MINE_A));
    expect(await repo.listForGroups("modryvabot", [], [1n])).toEqual([]);
  });

  it("listForBot reaches the private-chat opens the group queries cannot", async () => {
    // The owner's view. A person who only ever launched the app from a private
    // chat belongs to no community, so listForGroups can only find them if they
    // were already known from a verification — for everyone else they are
    // invisible. This is the query that sees them.
    const repo = new InMemoryMiniappVisitRepository();
    await repo.record(open(1n, MINE_A));
    await repo.record(open(7n)); // never in a group: private chat only
    await repo.record(open(3n, THEIRS));

    expect(
      (await repo.listForGroups("modryvabot", [MINE_A], [])).map(
        (r) => r.telegramUserId,
      ),
    ).toEqual([1n]);
    expect(
      (await repo.listForBot("modryvabot")).map((r) => r.telegramUserId).sort(),
    ).toEqual([1n, 3n, 7n]);
  });

  it("still lets a group-less open through for someone known in any of them", async () => {
    const repo = new InMemoryMiniappVisitRepository();
    await repo.record(open(7n));
    expect(
      await repo.listForGroups("modryvabot", [MINE_A, MINE_B], []),
    ).toEqual([]);
    expect(
      await repo.listForGroups("modryvabot", [MINE_A, MINE_B], [7n]),
    ).toHaveLength(1);
  });
});
