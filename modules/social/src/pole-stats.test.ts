import { describe, expect, it } from "vitest";
import {
  bestStreak,
  type ClaimRecord,
  currentStreak,
  filterByPeriod,
  nextDayKey,
  previousDayKey,
  rankingFrom,
  recordsFrom,
} from "./pole-stats.js";

const claim = (
  userId: string,
  position: number,
  dayKey: string,
  latencyMs = 1000,
  userName: string | null = `u${userId}`,
): ClaimRecord => ({ userId, userName, position, dayKey, latencyMs });

describe("rankingFrom", () => {
  it("orders by golds first, then silvers, then bronzes", () => {
    const rows = rankingFrom([
      claim("a", 1, "2026-07-01"),
      claim("b", 1, "2026-07-02"),
      claim("b", 1, "2026-07-03"),
      claim("a", 2, "2026-07-02"),
      claim("c", 2, "2026-07-03"),
      claim("c", 3, "2026-07-01"),
    ]);
    expect(rows.map((row) => row.userId)).toEqual(["b", "a", "c"]);
    expect(rows[0]?.firsts).toBe(2);
    expect(rows[1]?.seconds).toBe(1);
  });

  it("is stable when two people have identical records", () => {
    const rows1 = rankingFrom([
      claim("z", 1, "2026-07-01"),
      claim("a", 1, "2026-07-02"),
    ]);
    const rows2 = rankingFrom([
      claim("a", 1, "2026-07-02"),
      claim("z", 1, "2026-07-01"),
    ]);
    expect(rows1.map((r) => r.userId)).toEqual(rows2.map((r) => r.userId));
  });

  it("keeps the most recent name it saw", () => {
    const rows = rankingFrom([
      claim("a", 1, "2026-07-01", 1000, "Viejo"),
      claim("a", 2, "2026-07-02", 1000, "Nuevo"),
    ]);
    expect(rows[0]?.userName).toBe("Nuevo");
  });

  it("does not invent a name when there never was one", () => {
    const rows = rankingFrom([claim("a", 1, "2026-07-01", 1000, null)]);
    expect(rows[0]?.userName).toBeNull();
  });
});

describe("currentStreak", () => {
  const claims = [
    claim("a", 1, "2026-07-28"),
    claim("a", 1, "2026-07-29"),
    claim("a", 1, "2026-07-30"),
  ];

  it("counts consecutive wins ending today", () => {
    expect(currentStreak(claims, "a", "2026-07-30")).toBe(3);
  });

  it("does NOT break just because today is not claimed yet", () => {
    // The window is still open. Breaking the streak at 00:01 would be cruel and
    // wrong: the person has not lost anything yet.
    expect(currentStreak(claims, "a", "2026-07-31")).toBe(3);
  });

  it("breaks once a whole day has passed with no win", () => {
    expect(currentStreak(claims, "a", "2026-08-01")).toBe(0);
  });

  it("breaks the moment somebody else takes today's pole", () => {
    // Coming second today is not "today is still open": the streak is over.
    const mixed = [
      claim("a", 1, "2026-07-29"),
      claim("b", 1, "2026-07-30"),
      claim("a", 2, "2026-07-30"),
    ];
    expect(currentStreak(mixed, "a", "2026-07-30")).toBe(0);
  });

  it("still counts yesterday while today's pole is genuinely unclaimed", () => {
    const open = [claim("a", 1, "2026-07-29"), claim("b", 2, "2026-07-30")];
    // Only a SECOND place exists today, so the pole itself is still up for
    // grabs and the streak is not lost yet.
    expect(currentStreak(open, "a", "2026-07-30")).toBe(1);
  });

  it("counts nothing for someone who never won", () => {
    expect(currentStreak(claims, "zzz", "2026-07-30")).toBe(0);
  });

  it("survives a month boundary", () => {
    const across = [claim("a", 1, "2026-07-31"), claim("a", 1, "2026-08-01")];
    expect(currentStreak(across, "a", "2026-08-01")).toBe(2);
  });
});

describe("bestStreak", () => {
  it("finds the longest run, not the latest one", () => {
    const claims = [
      claim("a", 1, "2026-07-01"),
      claim("a", 1, "2026-07-02"),
      claim("a", 1, "2026-07-03"),
      claim("a", 1, "2026-07-04"),
      // gap
      claim("a", 1, "2026-07-20"),
      claim("a", 1, "2026-07-21"),
    ];
    expect(bestStreak(claims, "a")).toBe(4);
  });

  it("is 1 for a single win and 0 for none", () => {
    expect(bestStreak([claim("a", 1, "2026-07-01")], "a")).toBe(1);
    expect(bestStreak([claim("a", 2, "2026-07-01")], "a")).toBe(0);
  });
});

describe("recordsFrom", () => {
  it("only considers first places for 'fastest'", () => {
    // A subpole 40 ms after the pole is a fast reaction to someone else, not a
    // fast claim, and must never hold the record.
    const records = recordsFrom([
      claim("a", 1, "2026-07-01", 5000),
      claim("b", 2, "2026-07-01", 40),
    ]);
    expect(records.fastest?.userId).toBe("a");
    expect(records.fastest?.latencyMs).toBe(5000);
  });

  it("reports who holds the best streak", () => {
    const records = recordsFrom([
      claim("a", 1, "2026-07-01"),
      claim("b", 1, "2026-07-02"),
      claim("b", 1, "2026-07-03"),
    ]);
    expect(records.bestStreakUserId).toBe("b");
    expect(records.bestStreakDays).toBe(2);
  });

  it("says nothing rather than something wrong when there is no data", () => {
    const records = recordsFrom([]);
    expect(records.fastest).toBeNull();
    expect(records.bestStreakUserId).toBeNull();
    expect(records.bestStreakDays).toBe(0);
  });
});

describe("filterByPeriod", () => {
  const claims = [
    claim("a", 1, "2025-12-31"),
    claim("a", 1, "2026-06-15"),
    claim("a", 1, "2026-07-29"),
    claim("a", 1, "2026-07-30"),
  ];

  it("slices by day, month, year and all", () => {
    expect(filterByPeriod(claims, "day", "2026-07-30")).toHaveLength(1);
    expect(filterByPeriod(claims, "month", "2026-07-30")).toHaveLength(2);
    expect(filterByPeriod(claims, "year", "2026-07-30")).toHaveLength(3);
    expect(filterByPeriod(claims, "all", "2026-07-30")).toHaveLength(4);
  });
});

describe("day arithmetic", () => {
  it("crosses months and years", () => {
    expect(previousDayKey("2026-08-01")).toBe("2026-07-31");
    expect(previousDayKey("2026-01-01")).toBe("2025-12-31");
    expect(nextDayKey("2026-12-31")).toBe("2027-01-01");
  });

  it("handles a leap day", () => {
    expect(nextDayKey("2028-02-28")).toBe("2028-02-29");
    expect(previousDayKey("2028-03-01")).toBe("2028-02-29");
  });

  it("returns the input unchanged rather than throwing on rubbish", () => {
    expect(previousDayKey("no-es-una-fecha")).toBe("no-es-una-fecha");
  });
});
