import { describe, expect, it } from "vitest";
import {
  detectRaidSignals,
  RAID_BURST_MIN_JOINS,
  RAID_NAME_SIMILARITY_THRESHOLD,
  RAID_SIMILAR_MIN_GROUP,
  type RaidJoin,
  type RaidSignal,
  raidLargestSimilarGroup,
  raidNameSimilarity,
  raidNormalizeName,
  raidRecentJoins,
} from "./raid-signals.js";

const NOW = 1_000_000;
const WINDOW = 10_000;

const join = (name: string, ms: number): RaidJoin => ({ name, ms });

const bySignalKey = (
  signals: readonly RaidSignal[],
  key: string,
): RaidSignal => {
  const found = signals.find((s) => s.key === key);
  if (found === undefined) {
    throw new Error(`missing signal ${key}`);
  }
  return found;
};

describe("raidNormalizeName", () => {
  it("trims, lowercases and collapses internal whitespace", () => {
    expect(raidNormalizeName("  Juan   Perez ")).toBe("juan perez");
  });

  it("leaves an already normalized name untouched", () => {
    expect(raidNormalizeName("bot99")).toBe("bot99");
  });
});

describe("raidNameSimilarity", () => {
  it("returns 1 for identical names after normalizing", () => {
    expect(raidNameSimilarity("Raider", "  raider ")).toBe(1);
  });

  it("returns 1 for two empty names", () => {
    expect(raidNameSimilarity("", "   ")).toBe(1);
  });

  it("scores a one-char difference near 1 for long names", () => {
    expect(raidNameSimilarity("raider01", "raider02")).toBeCloseTo(0.875, 5);
  });

  it("scores completely different names low", () => {
    expect(raidNameSimilarity("abcd", "wxyz")).toBe(0);
  });

  it("is symmetric", () => {
    expect(raidNameSimilarity("alpha", "alphaa")).toBeCloseTo(
      raidNameSimilarity("alphaa", "alpha"),
      10,
    );
  });
});

describe("raidLargestSimilarGroup", () => {
  it("returns 0 for an empty list", () => {
    expect(raidLargestSimilarGroup([], RAID_NAME_SIMILARITY_THRESHOLD)).toBe(0);
  });

  it("returns 1 when all names are distinct", () => {
    expect(
      raidLargestSimilarGroup(
        ["banana", "kiwi", "melon"],
        RAID_NAME_SIMILARITY_THRESHOLD,
      ),
    ).toBe(1);
  });

  it("counts identical names as one big group", () => {
    expect(
      raidLargestSimilarGroup(
        ["spam", "spam", "spam", "spam"],
        RAID_NAME_SIMILARITY_THRESHOLD,
      ),
    ).toBe(4);
  });

  it("groups near-identical names above the threshold", () => {
    expect(
      raidLargestSimilarGroup(
        ["raider01", "raider02", "raider03", "totally_other"],
        RAID_NAME_SIMILARITY_THRESHOLD,
      ),
    ).toBe(3);
  });
});

describe("raidRecentJoins", () => {
  it("keeps only joins inside the window, boundaries included", () => {
    const joins = [
      join("a", NOW - WINDOW), // lower boundary -> included
      join("b", NOW - WINDOW / 2),
      join("c", NOW), // upper boundary -> included
    ];
    expect(raidRecentJoins(joins, WINDOW, NOW)).toEqual(joins);
  });

  it("drops joins older than the window and future joins", () => {
    const joins = [
      join("old", NOW - WINDOW - 1),
      join("ok", NOW - 1),
      join("future", NOW + 1),
    ];
    expect(raidRecentJoins(joins, WINDOW, NOW)).toEqual([join("ok", NOW - 1)]);
  });

  it("returns empty when windowMs is not positive", () => {
    const joins = [join("a", NOW)];
    expect(raidRecentJoins(joins, 0, NOW)).toEqual([]);
    expect(raidRecentJoins(joins, -5, NOW)).toEqual([]);
  });

  it("preserves input order", () => {
    const joins = [join("x", NOW - 3), join("y", NOW - 2), join("z", NOW - 1)];
    expect(raidRecentJoins(joins, WINDOW, NOW).map((j) => j.name)).toEqual([
      "x",
      "y",
      "z",
    ]);
  });
});

describe("detectRaidSignals", () => {
  it("always returns both signals with the expected keys", () => {
    const signals = detectRaidSignals([], WINDOW, NOW);
    expect(signals.map((s) => s.key)).toEqual([
      "raid_join_burst",
      "raid_name_similarity",
    ]);
  });

  it("reports no burst and no similarity for empty input", () => {
    const signals = detectRaidSignals([], WINDOW, NOW);
    for (const s of signals) {
      expect(s.present).toBe(false);
      expect(s.weight).toBe(0);
      expect(s.detail).toBeUndefined();
    }
  });

  it("flags a burst once enough joins land inside the window", () => {
    const joins: RaidJoin[] = [];
    for (let i = 0; i < RAID_BURST_MIN_JOINS; i += 1) {
      joins.push(join(`user${i}`, NOW - i * 100));
    }
    const burst = bySignalKey(
      detectRaidSignals(joins, WINDOW, NOW),
      "raid_join_burst",
    );
    expect(burst.present).toBe(true);
    expect(burst.detail).toBe(
      `${RAID_BURST_MIN_JOINS} uniones en ${WINDOW} ms`,
    );
    expect(burst.weight).toBeCloseTo(0.5, 5);
  });

  it("does not flag a burst just below the threshold", () => {
    const joins: RaidJoin[] = [];
    for (let i = 0; i < RAID_BURST_MIN_JOINS - 1; i += 1) {
      joins.push(join(`user${i}`, NOW - i * 100));
    }
    const burst = bySignalKey(
      detectRaidSignals(joins, WINDOW, NOW),
      "raid_join_burst",
    );
    expect(burst.present).toBe(false);
    expect(burst.detail).toBeUndefined();
  });

  it("saturates the burst weight at 1", () => {
    const joins: RaidJoin[] = [];
    for (let i = 0; i < RAID_BURST_MIN_JOINS * 4; i += 1) {
      joins.push(join(`user${i}`, NOW - i));
    }
    const burst = bySignalKey(
      detectRaidSignals(joins, WINDOW, NOW),
      "raid_join_burst",
    );
    expect(burst.weight).toBe(1);
  });

  it("ignores joins outside the window when counting the burst", () => {
    const joins: RaidJoin[] = [];
    for (let i = 0; i < RAID_BURST_MIN_JOINS; i += 1) {
      joins.push(join(`user${i}`, NOW - WINDOW - 1 - i));
    }
    const burst = bySignalKey(
      detectRaidSignals(joins, WINDOW, NOW),
      "raid_join_burst",
    );
    expect(burst.present).toBe(false);
  });

  it("flags name similarity for coordinated near-identical names", () => {
    const joins = [
      join("raider01", NOW - 4),
      join("raider02", NOW - 3),
      join("raider03", NOW - 2),
    ];
    const sim = bySignalKey(
      detectRaidSignals(joins, WINDOW, NOW),
      "raid_name_similarity",
    );
    expect(sim.present).toBe(true);
    expect(sim.detail).toBe(`${RAID_SIMILAR_MIN_GROUP} nombres similares`);
    expect(sim.weight).toBeCloseTo(0.5, 5);
  });

  it("does not flag similarity for varied distinct names", () => {
    const joins = [
      join("banana", NOW - 3),
      join("kiwi", NOW - 2),
      join("melon", NOW - 1),
    ];
    const sim = bySignalKey(
      detectRaidSignals(joins, WINDOW, NOW),
      "raid_name_similarity",
    );
    expect(sim.present).toBe(false);
    expect(sim.detail).toBeUndefined();
  });

  it("only considers names of joins inside the window for similarity", () => {
    const joins = [
      join("raiderAA", NOW - WINDOW - 10),
      join("raiderAB", NOW - WINDOW - 9),
      join("raiderAC", NOW - 1),
    ];
    const sim = bySignalKey(
      detectRaidSignals(joins, WINDOW, NOW),
      "raid_name_similarity",
    );
    expect(sim.present).toBe(false);
  });

  it("can fire both signals together on a coordinated raid", () => {
    const joins: RaidJoin[] = [];
    for (let i = 0; i < RAID_BURST_MIN_JOINS; i += 1) {
      joins.push(join(`clonebot0${i}`, NOW - i * 50));
    }
    const signals = detectRaidSignals(joins, WINDOW, NOW);
    expect(bySignalKey(signals, "raid_join_burst").present).toBe(true);
    expect(bySignalKey(signals, "raid_name_similarity").present).toBe(true);
  });

  it("is deterministic for identical inputs", () => {
    const joins = [
      join("raider01", NOW - 3),
      join("raider02", NOW - 2),
      join("raider03", NOW - 1),
    ];
    expect(detectRaidSignals(joins, WINDOW, NOW)).toEqual(
      detectRaidSignals(joins, WINDOW, NOW),
    );
  });

  it("returns empty-equivalent signals when windowMs is not positive", () => {
    const joins = [
      join("raider01", NOW - 3),
      join("raider02", NOW - 2),
      join("raider03", NOW - 1),
    ];
    const signals = detectRaidSignals(joins, 0, NOW);
    for (const s of signals) {
      expect(s.present).toBe(false);
    }
  });
});
